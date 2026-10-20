# Users

## Goal

Give FDE users a personal workspace to save software, run mock agents, and manage credits.

## Scope

- Auth stack: Better Auth with the Node `node:sqlite` adapter.
- Email/password registration, login, logout, session.
- Keep `ADMIN_TOKEN` for editorial admin until migrated to the Better Auth admin plugin.
- User dashboard.
- Favorite software only.
- Mock FDE agent runs.
- Credit balance, ledger, and virtual top-up.
- No email verification, password reset, OAuth, real payment, or real AI execution.

## Data

- `users`, `user_sessions`: existing.
- `user_favorites`: `user_id`, `software_id`, `created_at`.
- `user_wallets`: `user_id`, `balance`, `updated_at`.
- `credit_transactions`: `user_id`, `kind`, `amount`, `balance_after`, `reference_*`, `idempotency_key`, `note`, `created_at`.
- `agent_runs`: `user_id`, `agent_key`, `title`, `input_json`, `output_json`, `status`, `credits_cost`, `created_at`, `completed_at`.

## Routes

- `GET /{locale}/dashboard`
- `POST /{locale}/favorites/:slug`
- `POST /{locale}/credits/topup`
- `POST /{locale}/agent-runs`
- `GET /{locale}/agent-runs/:id`
- `GET /{locale}/account`

## Dashboard

- Show credit balance, favorite count, and agent run count.
- Show quick links to process, software, and industry.
- Show mock agent form, recent runs, favorites, credit ledger, and top-up.
- Add favorite/unfavorite action on software detail.

## Mock Agent

- Agent key: `fde-match`.
- Input: objective, optional process, optional industry.
- Output: recommended software, rationale, next steps, risks.
- Cost: 10 credits per run.
- Status: immediate `succeeded`.
- Results are private to the owning user.

## Credits

- Initial balance: 0.
- Top-up: 100 CNY = 1000 credits.
- Packages: 100 / 500 / 1000 CNY.
- Debit and credit operations must be transactional.
- Top-up must be idempotent.

## Security

- All user data is scoped by the session user.
- Protected routes redirect unauthenticated users to login.
- All mutations validate authentication and cross-site requests.
- Reject insufficient credit balance.
