# Tracker

An offline-first family finance app with a simple payday sheet, reusable template, bill calendar and reports. Sign-in is required to open records. A new account starts with no payday sheets; the starting template uses the seven rows from the supplied Excel example.

## Run it

```powershell
npm install
npm run dev
```

Set up Supabase below before opening the local URL Vite prints. After sign-in, entries save immediately to IndexedDB, including while disconnected on that device. For an installable build:

```powershell
npm run build
npm run preview
```

The production build includes a PWA manifest, icons and a cached app shell. Browser installation and background notification support depend on the device and browser.

## Main flows

- **Payday:** create one sheet per date. Enter income, adjust copied rows, or use **Add expense** for an extra expense on that payday only. Tithes, total expenses and remaining money recalculate automatically. Extra expenses do not change the template or other cycles.
- **Payday / History monthly summary:** choose a month to see expenses and remaining money across its sheets. Expand the summary for each payday and combined totals by row. Draft rows count toward expenses; remaining money waits until all sheets have income.
- **History:** reopen earlier sheets without changing the template or other paydays.
- **Bills:** see scheduled dates and record payments.
- **More → Reports:** check payday, monthly and yearly totals from the simple sheets.
- **More → Template:** set the tithe percentage and default row names and amounts for future sheets.
- **More → Detailed tools:** the earlier loans, cards, wishlist, savings, transactions, rules and actual-spending reports remain available, alongside backup and sync.

Payday sheet rows are allocations, not paid transactions. The simple reports total those allocations; detailed transaction reports continue to show actual income and spending. The template is stored as a reserved category record so it can use the existing offline and cloud sync format without a database migration. Existing database names and backup format identifiers intentionally retain their old internal values to preserve earlier records.

Payments and contributions are transactions linked to their account or goal. A loan or card payment therefore changes its balance without a second manual edit. Automatic rules reserve budget. If a matching transaction is recorded, the reserve is reduced so the same amount is not deducted twice.

Deleting an item creates a tombstone for later synchronization. JSON backup includes tombstones and all local entries. Keep backup files private: they contain financial data in plain text.

## Supabase sign-in and sync

The app requires a Supabase account. To configure a new deployment:

1. Create a Supabase project you control.
2. Run [supabase/schema.sql](supabase/schema.sql) in that project's SQL editor.
3. Copy [.env.example](.env.example) to `.env.local` and set the project URL and **publishable** key. Do not put a service role key in the browser.
4. In Supabase Auth, create and confirm the intended account. Set the production Site URL and add the production URL to the redirect allow list. After the account works, turn off **Allow new users to sign up** if only existing accounts should have access.
5. Restart Vite and sign in. The app syncs on startup and reconnect; **More → Sync now** retries manually.

The `.env.local` file stays on your computer and is excluded from Git. If you later host the app, set the same two `VITE_` variables in your hosting provider's build environment. The publishable key is intended for client apps; keep every secret and service role key out of the frontend.

Records created in an earlier guest version remain in a separate local database. After sign-in, **More → Cloud sync → Export earlier records** downloads them; use **Import backup** to copy them into the account. The sync engine uploads pending records, downloads cloud records, retains deletion tombstones and asks you to resolve competing edits. It uses server-side version checks; cloud data is protected by per-user Row Level Security policies. The frontend login screen alone does not restrict account creation at the Supabase API: disable new signups in Supabase for an owner-only app.

Offline access needs a previously established session on the device. Signing out removes access through the app UI, but browser storage is not encrypted and someone with access to the same device profile may be able to inspect it. Keep a separate private browser/OS account on a shared device. Before relying on cloud sync as the only backup, test sign-in, offline creation, reconnect, two-device edits and conflict resolution against the live project.

## Checks

```powershell
npm test
npm run lint
npm run build
```

See [PLAN.md](PLAN.md) for the product decisions and accounting rules.
