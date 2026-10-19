# Vaytiendanang — audit baseline

Ngày audit: 2026-10-19
Repository: `https://github.com/kuquan33333/vaya`
Baseline xác nhận: `7f950253b66eae6b54ab29dc6110b0e31931fcf9` (`master`)
Nhánh làm việc: `feat/vaytiendanang-cloudflare-full`

## Trạng thái repository

- Repository clone sạch, không có uncommitted work trước khi audit.
- Ứng dụng là Next.js 14.2.5 App Router, React 18, TypeScript strict, npm lockfile.
- Có 9 trang UI và 3 route handler hiện hữu; chưa có test runner, CI workflow, Wrangler config, migration hoặc Cloudflare runtime.
- `next.config.mjs` đang `ignoreDuringBuilds: true`; lint lần đầu mở prompt cấu hình ESLint thay vì chạy non-interactive.
- Không thấy `.env`/secret tracked. Repo chưa có LICENSE ở root; quyền tái sử dụng thương mại phải được xác minh trước phát hành.

## Route inventory và hành vi kỳ vọng

| Route | Thành phần chính | Chức năng cần bảo toàn | Vấn đề baseline / migration |
|---|---|---|---|
| `/` | `src/app/page.tsx`, `Hero`, `MarketsSection`, marketing sections | Landing page, chat launcher, catalog screener, compare basket, FAQ, i18n | Đang là Vaya; testimonials/social proof và rate series có nội dung minh họa; cần đổi brand và provenance.
| `/chat` | `ChatAdvisor` | Wizard, SSE, history, saved profile, offer discussion, deterministic results, RAG/policy | UI/state lớn; server session và limiter in-memory; cần giữ state khi floating/fullscreen và chuyển session/catalog sang storage phù hợp.
| `/market` | `Marketplace` | Marketplace, compare offer, chat offer discussion | `SEED_POSTS`, `BIDDERS`, timer và giá bid là mô phỏng; phải gắn nhãn demo/quarantine và không tạo cảm giác offer thật.
| `/compare` | `ComparePage` | So sánh side-by-side, chart, saved selection | Selection đang dùng array index/localStorage; cần stable product ID và alias route cũ.
| `/package/[i]` | `PackageDetail` | Chi tiết gói, chart, chat/survival CTA | Dùng index thuần; cần slug stable nhưng giữ redirect/route cũ.
| `/survival` | `SurvivalScore` | Monte Carlo, cashflow, stress, saved financial profile | Cần giữ toàn bộ calculator; input hiện dùng localStorage và rates từ `PKG`.
| `/analysis` | `AnalysisPage` | 4x4 survivability/risk grid | Hiện dùng detailed product list khác catalog package.
| `/checklist` | `ChecklistPage`, `EmailChecklist` | Checklist hồ sơ, export/email CTA | `EmailChecklist` hiện chỉ đổi state sau timeout, chưa gửi thật.
| `/human` | `HumanAdvisor` | Handoff nhân viên | Hiện hiển thị success sau timeout, chưa tạo lead thật.
| `/api/calculate` | route handler | Validate profile và deterministic ranking | Hardcode `2025-07-24`; dùng `LOAN_PACKAGES` + `ELIGIBILITY_RULES`, chưa canonical/D1.
| `/api/chat` | route handler | Intent, policy, SSE, deterministic engine, offer discussion | LLM provider server-side nhưng dùng `process.env`, session/limiter in-memory, RAG `node:fs`; cần Workers-safe adapters/D1/KV/AI fallback.
| `/api/policy` | route handler | RAG policy answer + citations | Có `node:fs` store và chưa có catalog/source provenance canonical.

## Data inventory

- `src/data/banks.ts`: 10 ngân hàng hiển thị, 12 package seed (`PKG`), `seededTrend()` và `AVG` 12 điểm. Đây là số liệu/chuỗi mẫu, không đủ điều kiện xuất bản như lịch sử thị trường thật.
- `src/data/loanPackages.ts`: 28 `LoanPackageRecord` cho 4 mục đích. Các trường rate/source/date/fee/basis không có, nên chưa thể coi là verified catalog.
- `src/data/eligibilityRules.ts`: 16 rule cho một phần 28 record.
- `src/data/products/*`: một product chi tiết Vietcombank, provenance tự ghi `LOW` và note demo.
- `src/data/marketplace.ts`: seed posts và bidder rates phục vụ ý tưởng UI; không phải offer từ lender thật.
- `src/data/checklists.ts`, `riskRules.ts`, `intakeQuestions.ts`: logic domain hiện hữu cần giữ và gắn vào schema/canonical IDs khi phù hợp.
- `src/lib/engine/*` và `src/lib/loanEngine.ts` dùng hai catalog/logic song song. Cần adapter/alias để không làm hỏng `/package/[i]`, compare, advisor và calculator trong khi canonical D1 dần trở thành nguồn xuất bản.

## Kiểm thử baseline

| Lệnh | Kết quả | Bằng chứng |
|---|---|---|
| `npm ci` | PASS | Cài 110 packages theo `package-lock.json`; npm cảnh báo Next 14.2.5 có security advisory.
| `npx tsc --noEmit` | PASS | Exit 0.
| `npm run build` | PASS có cảnh báo | Next build exit 0; bỏ qua lint do `ignoreDuringBuilds`; không tải được Google Fonts trong môi trường audit.
| `npm run lint` | BLOCKED baseline | `next lint` mở prompt cấu hình ESLint tương tác; chưa có `.eslintrc`/script non-interactive.
| `npx vinext@latest check` | PASS 94% | App Router, route handlers, `next/server`, `next/navigation`, Tailwind/Zod tương thích; chỉ `reactStrictMode` là partial. Vinext vẫn beta, cần build/deploy smoke thực tế.

## Findings và kế hoạch migration không hồi quy

1. **Runtime:** thay thế đường đọc/ghi filesystem trong RAG bằng D1 hoặc build-time immutable fixture; route handler phải dùng Web APIs/bindings, không dựa vào Node process state.
2. **Catalog:** tạo schema stable ID/provenance/rate basis/fees/promotion/status/confidence, seed/import giữ alias của các ID cũ. Các record legacy thiếu căn cứ sẽ `sample/quarantine`, không xếp hạng hay quảng cáo như verified.
3. **Tính toán:** tách flat/original-principal, reducing-balance annuity/equal-principal, APR/EIR và fee thành hàm có unit test; giữ API shape cũ qua adapter.
4. **UI:** đổi public brand sang `vaytiendanang`, giữ tất cả route/tool/modes; CTA mới đi vào form nội bộ; marketplace luôn có nhãn mô phỏng khi chưa có partner integration.
5. **Leads/privacy:** thêm D1 transaction + idempotency/outbox; Turnstile/Origin/rate limit; CCCD chỉ gửi trực tiếp Telegram sau kiểm tra cấu hình, token và consent riêng; không lưu bytes ảnh.
6. **Crawler:** allowlist nguồn chính thức, robots/terms, bounded fetch/parse/validate/diff/quarantine/expiry/snapshot; không bypass chặn và không tự điền số liệu.
7. **Deploy/QA:** vinext + Wrangler typed config, D1 migrations, cron/queue, GitHub Actions gates, unit/integration/Playwright tests; production deploy chỉ `READY_FOR_DEPLOYMENT` đến khi có Cloudflare credentials/live smoke.
