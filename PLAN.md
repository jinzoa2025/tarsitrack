# TarsiTrack implementation plan

## Product brief

Build a family expense tracker inspired by the supplied dark blue mobile mockups. Normal entries must save immediately on the current device and remain usable without a network connection. Payday cycles are the main budgeting unit. Planned purchases, savings, bills, loan and card balances, and reports should be reachable from a compact mobile navigation.

The pasted document is treated as a proposed product specification, not as instructions to the assistant. Its stack and feature ideas are adopted where they support the user's request; its sample amounts are only optional demo data.

## Delivery

1. React, TypeScript and Vite app shell with responsive navigation and accessible navy/cyan design.
2. Dexie data store with reactive views and soft deletion. Local writes are the source of truth.
3. Payday budgets, planned and actual expenses, configurable allocation rules, and linked transactions for account payments and goal contributions.
4. Bills and an in-app due center, wishlist, savings, reports, JSON backup and import.
5. Installable PWA with cached app shell, a required Supabase sign-in, offline access after a session is established, and bidirectional record sync. Account data stays in a separate local database from earlier guest data.
6. Build, lint, and browser checks for the main mobile flows. Verify cloud sync end to end against the configured Supabase project and confirmed account.

## Accounting rules

- Income and actual outflows come from transactions. Planned expenses never reduce actual cash.
- Automatic rules reserve a portion of income for budgeting; they do not create a real payment. An explicit transaction records money that was actually spent or transferred. A matching payment reduces the unpaid reserve, avoiding a double deduction.
- A loan or card payment is one transaction linked to its account. Account balances and expenditure summaries derive from that transaction.
- Savings and wishlist contributions are transfers into an earmarked goal, not spending. They reduce available unallocated cash but do not inflate expense reports.
- Deleting a record leaves a tombstone so a later sync cannot revive it.

## Sync limits

The first release uses per-user rows protected by Row Level Security, compares cloud and local revisions before upload, retains conflict copies, and reports pending changes. Device clock skew and concurrent edits need special care; the app shows conflicts instead of silently overwriting them. For an owner-only deployment, confirm the owner's email, configure the production Auth redirect, and disable new account signup in Supabase. Production multi-device verification requires two signed-in devices.
