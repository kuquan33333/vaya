# Trạng thái triển khai vaytiendanang

Ngày cập nhật: 2026-10-20 (UTC)

Trạng thái tổng: **CODE-VALIDATED — production deployment blocked**. Commit
`6f8932c` đã qua CI, build và smoke test local. Hạ tầng Cloudflare hiện hữu vẫn
đang hoạt động, nhưng production chưa nhận commit này: deployment Pages hiện
tại `a8692eec-5bc7-4f89-8799-12fa5655eb0a` vẫn gắn với SHA `5c1f230`. Workflow
dispatch production `39368143475` đã dừng trước mọi lệnh Cloudflare vì sáu
GitHub Actions secrets deploy đang rỗng. `/api/health` production vẫn trả
503 degraded do runtime integrations chưa đủ; không gọi hệ thống là
production-ready.

## DONE — có bằng chứng trong repository

- Đã audit baseline commit `7f950253b66eae6b54ab29dc6110b0e31931fcf9` và đọc
  toàn bộ master prompt; baseline ghi tại `docs/AUDIT_BASELINE.md`.
- Vinext/Cloudflare Worker cho app, ingestor Worker riêng, D1,
  Queue/DLQ, cron `0 0 * * *` (07:00 Asia/Ho_Chi_Minh), typed bindings và một
  GitHub Actions workflow: `cloudflare.config.ts`, `workers/ingestor/` và
  `.github/workflows/deploy-cloudflare.yml`.
- D1 canonical catalog với provider bank + sáu consumer-finance provider,
  provenance, rate basis, promotion/post-promo, review queue, snapshots,
  `policy_chunks`, lead/consent/audit/outbox và crawler alert outbox: migrations
  `0001`–`0007`.
- Publication gate: chỉ product/rate `verified`, còn hạn, có basis tính được
  và đủ post-promo mới vào catalog/ranking. Fallback legacy được gắn `sample`
  và không được public rank.
- Công thức reducing balance, original-principal, monthly-flat, promo,
  unknown-fee, DTI, MCDA và các engine legacy được giữ; không gộp sai %/tháng
  với %/năm.
- Chat AI SSE, intent, RAG fallback, lịch sử client, saved profile, survival,
  analysis, checklist, i18n VI/EN/ZH và các route cũ vẫn có trong source. RAG
  production đọc D1 chunk đã review, không đọc filesystem/fixture trong Worker.
- Lead thật: Zod, same-origin, Turnstile, account Rate Limit + fallback,
  idempotency, D1 transaction, consent/audit, Queue/Telegram redaction;
  CCCD flow trực tiếp bằng Telegram `sendDocument`, HMAC upload token,
  MIME/magic-byte/size gate, separate Telegram consent, staff Access/JWT
  metadata view, best-effort delete và trang một hồ sơ `/staff/requests/*`.
- Crawler có robots/terms gate, allowlist, timeout/body limit, ETag,
  Last-Modified, hash, immutable observations, review queue, alert Telegram
  outbox và CLI review/publish có xác thực D1 API; product terms và rate
  history cũng đi qua review trước khi publish. Không có Admin UI.
- UI công khai đã đổi brand sang vaytiendanang; banner/catalog/compare/detail
  chỉ lấy D1 verified; CTA nội bộ; marketplace không còn offer/seed giả;
  biểu đồ legacy không còn seeded trend/AVG giả, rate history chỉ vẽ snapshot
  thật khi đủ dữ liệu.
- UI red-white mới đã được kiểm tra local trên Chromium với kích thước iPhone
  375px và desktop 1280px: carousel bốn chủ đề, CTA nội bộ, estimator chỉ
  tính từ product verified, form đăng ký giữ context, chat nổi có dialog/focus
  và footer mobile không tràn ngang. Đây chưa phải bằng chứng Safari/WebKit
  thật và chưa phải production smoke test.
- Cloudflare live: D1 production, Queue/DLQ, app Worker, ingestor Worker với
  cron + Queue consumer và Pages project hiện hữu `vaytiendanang` đã được
  kiểm chứng. Production root/catalog trả 200; staging preview cũng trả
  root/catalog 200. Không tạo Pages project mới và không có R2 binding.

## PARTIAL — đã có code nhưng phụ thuộc dữ liệu/quyền thật

- Catalog hiện có **0 product/rate/banner verified**. Provider registry chỉ là
  allowlist đang `pending_verification`; giao diện rỗng là hành vi an toàn.
- Crawler chưa được phép chạy source nào vì `terms_status` vẫn `unknown` và
  `crawl_enabled=0`. Robots audit chỉ là kiểm tra read-only, không phải quyền
  crawl hay xác minh điều khoản.
- AI chạy thật khi có chat key; RAG cần thêm DashScope embedding key/model.
  Không có key thì báo unavailable. RAG có schema/loader D1 nhưng chưa có
  policy chunk hợp pháp đã embed và review.
- Telegram document delivery cần live bot/chat configuration; Telegram Bot
  không mã hóa đầu cuối và không bảo đảm thu hồi. AV/malware scanning, kiểm tra
  ảnh chuyên dụng và quy trình pháp lý cần tích hợp thêm theo hạ tầng thực tế.
- Chat transcript bền ở localStorage phía client; server session là cache
  isolate và được rehydrate mỗi request, chưa dùng `chat_sessions` D1.
- CI có lint/typecheck/unit/Next/Vinext build và live-health gate; smoke test
  local có Playwright Chromium iPhone-UA/desktop, nhưng WebKit executable
  không có trong môi trường này. Live health production hiện trả 503 vì
  secrets còn thiếu, đúng với fail-closed gate.

## BLOCKED — người vận hành phải cung cấp

- GitHub Actions cần `CLOUDFLARE_API_TOKEN` tại repository secret, rồi chạy
  workflow dispatch `target=staging` trước `target=production`. Account ID,
  D1 IDs và URL deploy là định danh công khai đã cố định trong workflow; không
  cần đưa chúng vào GitHub Secrets. Token phải giới hạn account đích và có
  quyền Workers Scripts Edit, Pages Edit, D1 Edit, Queues Edit (cộng Account
  Settings Read nếu Wrangler yêu cầu); không cần và không được cấp R2.
- LLM key/model, Turnstile site/secret, Telegram bot token + allowlisted chat
  ID, `PUBLIC_SITE_URL`, Zalo HTTPS URL, Cloudflare Access team domain/audience
  và danh sách nhân viên allowlist.
- Terms/crawl permission, URL sản phẩm/PDF hợp pháp và reviewer có thẩm quyền;
  không thể tự biến nguồn bị 403/unknown thành verified.
- Phê duyệt quyền sử dụng code/assets/mascot và privacy/legal notice cho xử lý
  dữ liệu cá nhân tại Việt Nam; tình trạng license được ghi ở
  `docs/THIRD_PARTY_LICENSES.md`.

Không claim Telegram/Turnstile/Access hoặc dữ liệu lãi suất đã chạy thật khi
các blocker trên chưa được cung cấp và smoke test tương ứng chưa có log.
