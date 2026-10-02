# TarsiTrack

An offline-first family expense tracker based on the supplied navy and electric blue mobile mockups. Sign-in is required to open the ledger. A new account starts with an empty ledger; **Load sample data** adds optional example records.

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

- **Home:** loans and cards overview, available budget, wishlist progress and current payday snapshot.
- **Expenses:** transaction history and planned versus actual category budgets.
- **Planning:** payday cycles, bills calendar, loans, cards, wishlist, savings and automatic rules.
- **Reports:** actual income and spending charts, loaded only when opened.
- **More:** categories, local JSON backup, import, cloud sync and sign-out.

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
