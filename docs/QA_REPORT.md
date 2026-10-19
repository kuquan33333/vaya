# QA report

Ngày kiểm tra: 2026-10-19 (UTC)

## Automated checks

| Check | Result | Evidence/notes |
|---|---|---|
| `npm run lint` | PASS | 0 errors, 0 warnings |
| `npm run typecheck` | PASS | `tsc --noEmit` |
| `npm test` | PASS | 8 test files, 21 tests |
| `npm run build` | PASS | Next production build |
| `npm run build:vinext` | PASS | Cloudflare/Vinext build |
| `git diff --check` | PASS | no whitespace errors |
| `cf d1 migrations apply <local UUID> --local` | PASS | 7 migrations applied, including review_queue term/history gate |
| local smoke (`npm start` + HTTP requests) | PASS | Home, catalog, package, invalid calculate/lead requests responded as expected; health returned 503 because local bindings/secrets are absent |

Unit tests cover canonical loan math/rate gates, ranking basis grouping,
legacy-catalog publication gate, crawler robots/HTTP/review behavior, lead
schema, document magic bytes, staff Access boundary and D1 RAG fail-closed
loading. No test uses customer PII or real credentials.

## Runtime checks requiring credentials

The following are intentionally **PENDING**, not passed: D1 migrations on the
user account, `/api/health` live readiness, real lead/idempotency replay,
Turnstile verification, R2 upload/retention/staff download, Cloudflare Access
JWT, Telegram success/retry/DLQ, Zalo URL, crawler cron/manual run, real LLM
stream/RAG, browser responsive E2E and GitHub deploy/rollback.

The current repository-only result is therefore `READY_FOR_DEPLOYMENT`, not a
claim of production deployment.
