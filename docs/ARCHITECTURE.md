# Kiến trúc vận hành vaytiendanang

## Ranh giới hệ thống

```text
Browser
  ├─ catalog/compare/product pages ──> /api/catalog, /api/products/[slug]
  ├─ chat ──> /api/chat ──> intent + verified catalog engine + optional LLM
  └─ lead form ──> /api/leads ──> D1 transaction ──> Queue ──> Telegram

Cloudflare Worker (Vinext)
  ├─ D1: source registry, products, rates, review queue, leads, audit/outbox
  ├─ D1: verified policy_chunks and immutable rate_history snapshots
  ├─ R2 private: optional document objects
  └─ Queue binding: notification delivery

Ingestor Worker (cron)
  ├─ reads only data_sources with robots/terms explicitly allowed
  ├─ fetches bounded HTML/JSON with conditional headers
  └─ writes immutable observations/review_queue; never publishes automatically
```

## Dữ liệu công khai

`loadCatalog()` đọc product và rate terms từ D1. `publicProducts()` là cổng
publication duy nhất: product và rate phải `verified`, có basis được hỗ trợ,
có giá trị, và có rate sau promotion nếu promotion chưa kết thúc. `sample`,
`quarantine`, `expired` và record thiếu provenance không đi vào `/api/catalog`,
`/api/products/[slug]`, `/api/calculate` hoặc kết quả ranking của `/api/chat`.

Dữ liệu legacy vẫn được giữ trong source để không làm hỏng các thuật toán và
fixture cũ, nhưng được gắn `sample`/`not-for-ranking` và không phải fallback
công khai.

## AI và engine

Intent extraction, hội thoại, RAG và narration dùng LLM tùy chọn. Engine tài
chính là pure code: rate basis, amortization, DTI, risk, MCDA, survivability.
Khi API key chưa cấu hình, AI không giả lập kết quả; phần deterministic vẫn có
thể trả trạng thái dữ liệu phù hợp.

## Lead và notification

Lead được validate bằng Zod, kiểm tra same-origin, rate-limit, Turnstile nếu đã
cấu hình và bắt buộc idempotency key. D1 batch ghi lead, consent, outbox và
audit. Queue chỉ chuyển `notificationId`; ingestor đọc payload đã redacted từ
outbox. Telegram retry tối đa năm lần rồi `dead_letter`.

R2 không public. Upload token là HMAC có side (`front`/`back`), lead id và hạn
30 phút. API không trả URL public và không gửi object key vào Telegram.

## RAG và review không có Admin UI

`policy_chunks` trong D1 chứa text, embedding, source hash/URL và trạng thái.
`/api/policy` và `/api/chat` chỉ retrieve `status='verified'`; lỗi/missing
migration trả trạng thái không tìm thấy tài liệu, không dùng chunk legacy để
đoán. Reviewer vận hành `npm run catalog:review` qua Cloudflare D1 API để
approve/reject và publish entity đã được đối chiếu; mỗi thao tác ghi
`audit_events`. `npm run catalog:import -- --file <batch.json>` chỉ nhập dữ
liệu ở trạng thái `quarantine`, nên nguồn được cung cấp hợp pháp cũng không
thể tự trở thành dữ liệu công khai.

Crawler thay đổi nguồn tạo `review_queue` + `crawl_alert_outbox`, rồi ingestor
gửi cảnh báo Telegram đã loại PII. Product/rate/promotion/banner không được
auto-publish từ observation.

## Staff và lifecycle

Telegram chỉ link đến một hồ sơ opaque `/staff/requests/<publicId>`. Trang này
không liệt kê lead; Cloudflare Access bảo vệ ở edge và API còn tự xác minh
Access JWT/audience/issuer. Staff có thể đổi status hoặc thu hồi/xóa; cron
ingestor xóa object R2 hết hạn theo retention mặc định 30 ngày.
