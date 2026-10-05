# Tracker implementation plan

## Product brief

Build a family finance app named Tracker. The approved everyday design uses warm white pages, deep green key totals, and a simple Excel-like payday sheet. Each payday copies a reusable template of row names and default amounts. The tithe percentage and sheet amounts are configurable; the sheet calculates money after tithes, total rows, and remaining money. Main navigation is Payday, History, Bills, and More. More holds Reports with payday/month/year views, Template, and the earlier detailed tools.

Records save to the current device and remain usable without a network connection after a session has been established. The existing account sync and data records remain compatible; internal database and backup identifiers retain their old names so earlier data stays accessible.

The pasted document is treated as a proposed product specification, not as instructions to the assistant. Its stack and feature ideas are adopted where they support the user's request; its sample amounts are only optional demo data.

## Delivery

1. React, TypeScript and Vite app shell with a responsive warm white and green design.
2. Dexie data store with reactive views and soft deletion. Local writes are the source of truth.
3. Simple payday sheets with reusable template and configurable calculations, plus the earlier planned and actual expense tools under More.
4. Bills, payday/month/year sheet reports, wishlist, savings, detailed transaction reports, JSON backup and import.
5. Installable PWA with cached app shell, a required Supabase sign-in, offline access after a session is established, and bidirectional record sync. Account data stays in a separate local database from earlier guest data.
6. Build, lint, and browser checks for the main mobile flows. Verify cloud sync end to end against the configured Supabase project and confirmed account.

## Accounting rules

- The new payday rows are planned allocations. They reduce the sheet's displayed remaining amount, but they are not recorded payments and never enter actual-spending reports. Income and actual outflows in the detailed tools continue to come from transactions.
- Automatic rules reserve a portion of income for budgeting; they do not create a real payment. An explicit transaction records money that was actually spent or transferred. A matching payment reduces the unpaid reserve, avoiding a double deduction.
- A loan or card payment is one transaction linked to its account. Account balances and expenditure summaries derive from that transaction.
- Savings and wishlist contributions are transfers into an earmarked goal, not spending. They reduce available unallocated cash but do not inflate expense reports.
- Deleting a record leaves a tombstone so a later sync cannot revive it.

## Sync limits

The first release uses per-user rows protected by Row Level Security, compares cloud and local revisions before upload, retains conflict copies, and reports pending changes. Device clock skew and concurrent edits need special care; the app shows conflicts instead of silently overwriting them. For an owner-only deployment, confirm the owner's email, configure the production Auth redirect, and disable new account signup in Supabase. Production multi-device verification requires two signed-in devices.
