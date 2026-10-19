# Nguồn dữ liệu và quy trình xác minh

## Nguyên tắc

Chỉ nguồn chính thức của ngân hàng/công ty tài chính, trang điều khoản chính
thức hoặc PDF chính thức được đưa vào review. Search snippet, quảng cáo bên thứ
ba, rate hard-code và giá trị suy đoán không được coi là nguồn công khai.

Mỗi rate cần có URL, hash nội dung, ngày quan sát, ngày tài liệu (nếu có), basis
(dư nợ giảm dần/dư nợ gốc/monthly flat), type, thời hạn hiệu lực và post-promo
rate nếu áp dụng. Phí chưa có nguồn giữ `NULL`; hệ thống không ước lượng.

## Crawler

Ingestor chỉ đọc source có:

1. URL HTTP(S) hợp lệ;
2. `robots.txt` cho phép user-agent đã đăng ký;
3. `terms_status='allowed'` do con người ghi nhận;
4. `crawl_enabled=1`.

Request có timeout 15 giây, giới hạn body 2 MiB, ETag/Last-Modified và hash.
HTML/JSON được lưu thành observation với candidate signals. Rate signal chỉ
tạo `review_queue` và `crawl_alert_outbox`; crawler không sửa `products.status`
hay `rate_terms.status`. Alert Telegram không chứa PII.

## Human review

Reviewer đối chiếu observation với trang/PDF gốc, kiểm tra basis, promotion,
phí, amount/term, eligibility và ngày hết hạn. Chỉ sau khi duyệt mới tạo/cập
nhật row `verified`. Nếu nguồn đổi, record cũ không bị âm thầm ghi đè; tạo
observation và review mới, rồi cập nhật snapshot có audit.

Nguồn được cung cấp hợp pháp ngoài crawler có thể nhập bằng
`npm run catalog:import -- --file <batch.json>`. Script chỉ ghi record
`quarantine` và tạo review item; nó không có nhánh `verified`. `productTerms`
và `rateHistory` cũng chỉ tạo review item, sau đó mới được ghi vào bảng
canonical bởi lệnh publish tương ứng. Schema batch và các lệnh
`activate-provider`/`enable-source` nằm trong phần help của
`catalog-review.mjs`. Không đưa thông tin khách hàng hoặc nội dung không có
quyền vào batch import.

Không có Admin UI. Reviewer dùng `scripts/catalog-review.mjs` với Cloudflare D1
API token để approve/reject review item rồi publish đúng entity đã approved;
mọi thay đổi ghi `audit_events`. Policy chunks RAG cũng phải được đưa vào D1
với source hash, embedding và `status='verified'` trước khi AI được phép dùng.

Registry hiện có ngân hàng legacy và sáu consumer-finance provider để làm
allowlist/identity. Các provider này đang `pending_verification`; điều đó
không có nghĩa họ đã có sản phẩm/lãi suất được công khai.

## Kiểm tra robots/khả năng truy cập gần nhất

Kiểm tra read-only ngày 2026-10-19 UTC bằng user-agent
`vaytiendanang-data-bot/1.0`. Đây chỉ là kiểm tra robots/HTTP, không phải phê
duyệt điều khoản crawl và không tạo ra sản phẩm verified.

| Provider | URL chính thức trong registry | robots | terms | crawl | Sản phẩm verified |
|---|---|---|---|---|---|
| Home Credit | https://www.homecredit.vn/ | HTTP 200, allow root | unknown | tắt | chưa có |
| FE CREDIT | https://fecredit.com.vn/ | HTTP 200, có disallow khu vực kỹ thuật | unknown | tắt | chưa có |
| HD SAISON | https://www.hdsaison.com.vn/ | HTTP 403 | unknown | tắt | chưa có |
| SHBFinance | https://www.shbfinance.com.vn/ | HTTP 200 sau redirect robots sang sfinance.com.vn | unknown | tắt | chưa có |
| Mcredit | https://mcredit.vn/ | chưa xác minh từ môi trường audit | unknown | tắt | chưa có |
| Mirae Asset Finance | https://miraeasset.com.vn/ | chưa xác minh từ môi trường audit | unknown | tắt | chưa có |

Các ngân hàng Vietcombank, BIDV, Techcombank và VPBank cũng trả robots HTTP
200 trong cùng lần kiểm tra; các nguồn còn lại vẫn giữ `unknown` cho tới khi
kiểm tra lại đúng URL sản phẩm và điều khoản. Migration `0004_source_audit...`
ghi lại trạng thái robots này nhưng cố ý không bật `crawl_enabled`. Cần người
có quyền của hệ thống xác nhận terms, chọn URL sản phẩm/PDF cụ thể và human
review trước khi cho crawler chạy.
