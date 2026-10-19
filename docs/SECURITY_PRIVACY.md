# Bảo mật và quyền riêng tư

## Dữ liệu lead

Lead lưu PII cần cho nhân viên liên hệ trong D1. Phone được normalize E.164;
IP, user-agent và audit actor dùng hash. Idempotency key chống tạo lead trùng.
Consent contact/processing/document được ghi riêng theo policy version.

Telegram chỉ nhận public lead id, nguồn và metadata hồ sơ tối thiểu. Không gửi
họ tên, phone, ghi chú, giấy tờ hoặc token. Queue/outbox retry không làm lộ PII
ra payload mới.

Crawler alert Telegram chỉ chứa provider/source URL, trạng thái review và thời
điểm quan sát; nó không dùng bảng lead và không chứa dữ liệu khách. Policy RAG
chỉ nạp D1 chunks đã verified, không gửi phone/CCCD vào embedding hoặc prompt.

## Tài liệu

Document upload tắt mặc định. Khi bật, chỉ nhận JPEG/PNG/WebP tối đa 8 MiB,
ghi private R2, lưu SHA-256 và object key trong D1. Token HMAC hết hạn sau 30
phút, gắn với lead và mặt giấy tờ. Magic bytes được kiểm tra trước khi ghi;
JPEG/PNG/WebP được xử lý để loại bỏ các nhóm EXIF/XMP/text metadata phổ biến
trước khi lưu.
Không có public URL; endpoint staff yêu cầu Cloudflare Access JWT, ghi audit
truy cập và không có trang Admin/listing. Cron ingestor xóa object hết hạn và
endpoint staff chuyển lead sang `deleted` sẽ thu hồi consent.

Staff có thể xem một hồ sơ qua `/staff/requests/<opaque-id>` sau Cloudflare
Access, đổi status hoặc thu hồi/xóa. Không có endpoint listing/Admin dashboard.

## Trust boundaries

- API validate Zod, same-origin, account-level Rate Limiting (local fallback) và Turnstile khi secret có mặt;
- LLM không được quyền quyết định rate/rank/eligibility;
- RAG/context và user text được sanitize, injection guard;
- secret chỉ đọc từ Cloudflare binding hoặc env local, không log giá trị;
- crawler có robots/terms gate, timeout, body limit và human review.

## Còn cần xác nhận trước production

Thiết lập Cloudflare Access team/audience và allowlist nhân viên; bổ sung AV/
malware scan (metadata stripping hiện chỉ là best-effort cho nhóm chunk/segment
phổ biến); cấu hình alerting
cho DLQ/outbox, backup/restore D1/R2, incident procedure, và xác nhận pháp lý
cho privacy notice, Telegram, logo/mascot và từng nguồn dữ liệu. Không bật R2
document flow trước các bước này.
