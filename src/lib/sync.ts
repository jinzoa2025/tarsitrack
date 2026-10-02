import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { type Entry, type TrackerDB } from './data'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

interface CloudRow {
  id: string
  user_id: string
  kind: Entry['kind']
  payload: Entry
  deleted_at: string | null
  updated_at: string
  version: number
  device_id: string
}

interface PushResult { applied: boolean; record: CloudRow }

function fromCloud(row: CloudRow): Entry {
  return {
    ...row.payload,
    id: row.id,
    kind: row.kind,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || undefined,
    baseVersion: row.version,
    deviceId: row.device_id,
    syncStatus: 'synced',
  }
}

export async function synchronize(db: TrackerDB, userId: string) {
  if (!supabase || !navigator.onLine) return { uploaded: 0, downloaded: 0, conflicts: 0 }
  let uploaded = 0
  let downloaded = 0
  let conflicts = 0
  const pending = await db.entries.where('syncStatus').equals('pending').toArray()

  for (const local of pending) {
    if (await db.conflicts.where('recordId').equals(local.id).count()) continue
    const { data, error } = await supabase.rpc('push_tracker_record', {
      p_id: local.id,
      p_kind: local.kind,
      p_payload: local,
      p_deleted_at: local.deletedAt || null,
      p_base_version: local.baseVersion,
      p_device_id: local.deviceId,
    })
    if (error) throw error
    const push = data as PushResult
    const row = push.record
    if (!push.applied) {
      await db.conflicts.put({ id: crypto.randomUUID(), recordId: local.id, local, remote: fromCloud(row), createdAt: new Date().toISOString() })
      conflicts++
      continue
    }
    // A local edit made while the request was in flight must remain pending.
    const current = await db.entries.get(local.id)
    if (current?.updatedAt === local.updatedAt) await db.entries.put(fromCloud(row))
    else if (current) await db.entries.put({ ...current, baseVersion: row.version })
    uploaded++
  }

  // A full paged pull avoids timestamp boundary gaps and includes tombstones.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('tracker_records').select('*').eq('user_id', userId).order('id').range(offset, offset + 499)
    if (error) throw error
    const rows = data as CloudRow[]
    for (const row of rows) {
      const local = await db.entries.get(row.id)
      if (local?.syncStatus === 'pending') {
        if (row.version > local.baseVersion && !(await db.conflicts.where('recordId').equals(row.id).count())) {
          await db.conflicts.put({ id: crypto.randomUUID(), recordId: row.id, local, remote: fromCloud(row), createdAt: new Date().toISOString() })
          conflicts++
        }
      } else if (!local || row.version > local.baseVersion) {
        await db.entries.put(fromCloud(row))
        downloaded++
      }
    }
    if (rows.length < 500) break
  }
  return { uploaded, downloaded, conflicts }
}
