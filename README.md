# TarsiTrack

An offline-first family expense tracker based on the supplied navy and electric blue mobile mockups. A fresh install starts with an empty ledger. The **Load sample data** button adds optional example records so the screens can be explored.

## Run it

```powershell
npm install
npm run dev
```

Open the local URL Vite prints. Normal entries save immediately to IndexedDB, including while disconnected. For an installable build:

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
- **More:** categories, local JSON backup, import and optional cloud sync.

Payments and contributions are transactions linked to their account or goal. A loan or card payment therefore changes its balance without a second manual edit. Automatic rules reserve budget. If a matching transaction is recorded, the reserve is reduced so the same amount is not deducted twice.

Deleting an item creates a tombstone for later synchronization. JSON backup includes tombstones and all local entries. Keep backup files private: they contain financial data in plain text.

## Optional Supabase sync

The app runs fully in guest mode without Supabase. To enable account sync:

1. Create a Supabase project you control.
2. Run [supabase/schema.sql](supabase/schema.sql) in that project's SQL editor.
3. Copy [.env.example](.env.example) to `.env.local` and set the project URL and **publishable** key. Do not put a service role key in the browser.
4. Restart Vite, create or sign in to an account, then use **More → Sync now**.

The `.env.local` file stays on your computer and is excluded from Git. If you later host the app, set the same two `VITE_` variables in your hosting provider's build environment. The publishable key is intended for client apps; keep every secret and service role key out of the frontend.

Guest records remain in a separate local database when you sign in. If you want to move them into an account, export a guest backup, sign in, and import that backup into the account. The sync engine uploads pending records, downloads cloud records, retains deletion tombstones and asks you to resolve competing edits. It uses server-side version checks; cloud data is protected by per-user Row Level Security policies.

The schema and client are implemented, but no Supabase project was provided, so multi-device sync has **not** been verified against a live project. A production rollout should test sign-in, offline creation, reconnect, two-device edits and conflict resolution before relying on it as the only backup.

## Checks

```powershell
npm test
npm run lint
npm run build
```

See [PLAN.md](PLAN.md) for the product decisions and accounting rules.
