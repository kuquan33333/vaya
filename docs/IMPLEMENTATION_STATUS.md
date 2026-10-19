# Trạng thái triển khai vaytiendanang

Ngày cập nhật: 2026-10-19 (UTC)

Trạng thái tổng: **READY_FOR_DEPLOYMENT — awaiting credentials**. Mã nguồn và
các kiểm tra offline đã được triển khai trong branch này; chưa được đánh dấu
production-ready vì chưa có Cloudflare account/URL/secret để chạy smoke test
thật.

## DONE — có bằng chứng trong repository

- Đã audit baseline commit `7f950253b66eae6b54ab29dc6110b0e31931fcf9` và đọc
  toàn bộ master prompt; baseline ghi tại `docs/AUDIT_BASELINE.md`.
- Vinext/Cloudflare Worker cho app, ingestor Worker riêng, D1, R2 private,
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
  document flow tùy chọn bằng R2 private, HMAC upload token, magic bytes, staff
  Access/JWT, audit view, retention xóa và trang một hồ sơ `/staff/requests/*`.
- Crawler có robots/terms gate, allowlist, timeout/body limit, ETag,
  Last-Modified, hash, immutable observations, review queue, alert Telegram
  outbox và CLI review/publish có xác thực D1 API; product terms và rate
  history cũng đi qua review trước khi publish. Không có Admin UI.
- UI công khai đã đổi brand sang vaytiendanang; banner/catalog/compare/detail
  chỉ lấy D1 verified; CTA nội bộ; marketplace không còn offer/seed giả;
  biểu đồ legacy không còn seeded trend/AVG giả, rate history chỉ vẽ snapshot
  thật khi đủ dữ liệu.

## PARTIAL — đã có code nhưng phụ thuộc dữ liệu/quyền thật

- Catalog hiện có **0 product/rate/banner verified**. Provider registry chỉ là
  allowlist đang `pending_verification`; giao diện rỗng là hành vi an toàn.
- Crawler chưa được phép chạy source nào vì `terms_status` vẫn `unknown` và
  `crawl_enabled=0`. Robots audit chỉ là kiểm tra read-only, không phải quyền
  crawl hay xác minh điều khoản.
- AI chạy thật khi có chat key; RAG cần thêm DashScope embedding key/model.
  Không có key thì báo unavailable. RAG có schema/loader D1 nhưng chưa có
  policy chunk hợp pháp đã embed và review.
- R2 upload có retention/delete, customer self-delete, staff Access và
  best-effort stripping các nhóm EXIF/XMP/text metadata phổ biến; AV/malware
  scanning, kiểm tra ảnh chuyên dụng và quy trình pháp lý cần tích hợp thêm
  theo hạ tầng thực tế.
- Chat transcript bền ở localStorage phía client; server session là cache
  isolate và được rehydrate mỗi request, chưa dùng `chat_sessions` D1.
- CI có lint/typecheck/unit/Next/Vinext build và live-health tùy chọn; chưa có
  Playwright E2E đầy đủ trong môi trường này.

## BLOCKED — người vận hành phải cung cấp

- Cloudflare account/token/account ID, resource IDs và quyền D1/R2/Queue/Worker;
  GitHub Actions production chưa thể deploy/health-check nếu thiếu chúng.
- LLM key/model, Turnstile site/secret, Telegram bot token + allowlisted chat
  ID, `PUBLIC_SITE_URL`, Zalo HTTPS URL, Cloudflare Access team domain/audience
  và danh sách nhân viên allowlist.
- Terms/crawl permission, URL sản phẩm/PDF hợp pháp và reviewer có thẩm quyền;
  không thể tự biến nguồn bị 403/unknown thành verified.
- Phê duyệt quyền sử dụng code/assets/mascot và privacy/legal notice cho xử lý
  dữ liệu cá nhân tại Việt Nam; tình trạng license được ghi ở
  `docs/THIRD_PARTY_LICENSES.md`.

Không claim deploy live, Telegram/R2/Turnstile/Access hoặc dữ liệu lãi suất đã
chạy thật khi các blocker trên chưa được cung cấp và smoke test chưa có log.
