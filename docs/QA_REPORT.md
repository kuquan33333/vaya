# QA report

Ngày kiểm tra: 2026-10-19 (UTC)

## Automated checks

| Check | Result | Evidence/notes |
|---|---|---|
| `npm run lint` | PASS | 0 errors (generated Cloudflare type file may emit non-blocking warnings) |
| `npm run typecheck` | PASS | `tsc --noEmit` |
| `npm test` | PASS | includes Telegram configuration/sendDocument byte-preservation tests |
| `npm run build` | PASS | Next production build |
| `npm run build:vinext` | PASS | Cloudflare/Vinext build |
| `git diff --check` | PASS | no whitespace errors |
| `cf d1 migrations apply <local UUID> --local` | PASS | 8 migrations applied, including Telegram metadata/consent gate |
| local smoke (`npm start` + HTTP requests) | PASS | Home, catalog, package, invalid calculate/lead requests responded as expected; health returned 503 because local bindings/secrets are absent |

Unit tests cover canonical loan math/rate gates, ranking basis grouping,
legacy-catalog publication gate, crawler robots/HTTP/review behavior, lead
schema, document magic bytes, staff Access boundary and D1 RAG fail-closed
loading. No test uses customer PII or real credentials.

## Runtime checks requiring credentials

The following are intentionally **PENDING**, not passed: `/api/health` live
readiness (currently verified as 503 with missing secrets), real
lead/idempotency replay, Turnstile verification, direct Telegram sendDocument
for both sides, Cloudflare Access JWT, Telegram notification retry/DLQ, Zalo
URL, crawler source run, real LLM stream/RAG, browser responsive E2E and
GitHub deploy/rollback.

Live checks completed: production Pages deployment `e44a4117` returned root
200 and `/api/catalog` 200; staging preview deployment `ffdc2874` returned
root 200 and `/api/catalog` 200. Both `/api/health` responses returned 503
with the expected fail-closed missing-secret checks. Production and staging
D1 ledgers contain migrations `0001`–`0008`; Queue consumers, DLQs and cron
triggers were created for both ingestor Workers.

The result is therefore `DEPLOYED_WITH_RUNTIME_SECRETS_PENDING`, not a claim
that Telegram/AI/Zalo/Turnstile/Access integrations are ready.
