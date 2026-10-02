-- Run in the SQL editor of the intended Supabase project before enabling cloud sync.
-- This file is kept under version control; the app never receives a service role key.
create table if not exists public.tracker_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('payday','transaction','plan','rule','loan','card','bill','wish','goal','category')),
  payload jsonb not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  device_id text not null
);

create index if not exists tracker_records_user_id_idx on public.tracker_records (user_id, id);
alter table public.tracker_records enable row level security;
revoke all on public.tracker_records from anon;
grant select, insert, update on public.tracker_records to authenticated;

create policy "read own tracker records" on public.tracker_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own tracker records" on public.tracker_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own tracker records" on public.tracker_records
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Optimistic version check preserves competing edits for user review.
create or replace function public.push_tracker_record(
  p_id uuid,
  p_kind text,
  p_payload jsonb,
  p_deleted_at timestamptz,
  p_base_version integer,
  p_device_id text
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare result public.tracker_records;
declare applied boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
  insert into public.tracker_records (id, user_id, kind, payload, deleted_at, updated_at, version, device_id)
  values (p_id, (select auth.uid()), p_kind, p_payload, p_deleted_at, now(), 1, p_device_id)
  on conflict (id) do update set
    kind = excluded.kind,
    payload = excluded.payload,
    deleted_at = excluded.deleted_at,
    updated_at = now(),
    version = tracker_records.version + 1,
    device_id = excluded.device_id
  where tracker_records.user_id = (select auth.uid()) and tracker_records.version = p_base_version
  returning * into result;
  applied := result.id is not null;
  if result.id is null then
    select * into result from public.tracker_records
    where id = p_id and user_id = (select auth.uid());
  end if;
  if result.id is null then raise exception 'Record unavailable'; end if;
  return jsonb_build_object('applied', applied, 'record', to_jsonb(result));
end;
$$;

revoke all on function public.push_tracker_record(uuid,text,jsonb,timestamptz,integer,text) from public, anon;
grant execute on function public.push_tracker_record(uuid,text,jsonb,timestamptz,integer,text) to authenticated;
