# Bảo mật và quyền riêng tư

## Dữ liệu lead

Lead lưu PII cần cho nhân viên liên hệ trong D1. Phone được normalize E.164;
IP, user-agent và audit actor dùng hash. Idempotency key chống tạo lead trùng.
Consent contact/processing/document/Telegram được ghi riêng theo policy version.

Telegram nhận public lead id, nguồn và metadata hồ sơ tối thiểu qua outbox;
không gửi họ tên, phone, ghi chú hoặc token. CCCD là luồng riêng: chỉ khi có
consent riêng `telegram_document`, Telegram đã được xác thực và upload token
hợp lệ thì route mới đọc bytes và gọi `sendDocument`. Queue/outbox retry không
làm lộ PII ra payload mới.

Crawler alert Telegram chỉ chứa provider/source URL, trạng thái review và thời
điểm quan sát; nó không dùng bảng lead và không chứa dữ liệu khách. Policy RAG
chỉ nạp D1 chunks đã verified, không gửi phone/CCCD vào embedding hoặc prompt.

## Tài liệu

CCCD upload chỉ nhận JPEG/PNG/WebP tối đa 8 MiB, kiểm tra MIME và magic bytes,
giữ nguyên bytes ảnh gốc rồi gửi trực tiếp bằng Telegram Bot `sendDocument`.
Trước khi đọc body, route gọi `getMe` và `getChat`; thiếu/malformed token, chat
không truy cập được hoặc thiếu signing key đều trả lỗi và không nhận ảnh. Token
HMAC hết hạn sau 30 phút, gắn với lead và mặt giấy tờ. D1 không chứa bytes ảnh;
chỉ lưu metadata, SHA-256, Telegram message/file id và trạng thái giao nhận.
Staff chỉ xem metadata qua Cloudflare Access; hệ thống không có endpoint tải ảnh.
Xóa sẽ xóa metadata, thử `deleteMessage` nếu được nhưng không bảo đảm Telegram
đã thu hồi ảnh.

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
cho DLQ/outbox, backup/restore D1, incident procedure, và xác nhận pháp lý cho
privacy notice, Telegram, logo/mascot và từng nguồn dữ liệu.
