# vaytiendanang

vaytiendanang là nền tảng tư vấn khoản vay cho người dùng Việt Nam, kế thừa
chat AI, Decision Engine, so sánh, checklist và các mô phỏng sức chịu đựng của
vaytiendanang. AI chỉ diễn giải; mọi con số tài chính phải đến từ engine và dữ liệu có
căn cứ.

## Trạng thái dữ liệu

Sản phẩm/lãi suất legacy trong `src/data` chỉ còn là fixture tương thích và
không được đưa vào catalog công khai hoặc xếp hạng. Catalog công khai đọc từ
D1 và chỉ mở record khi có nguồn, ngày quan sát, cơ sở lãi suất, điều khoản sau
ưu đãi (nếu có) và trạng thái `verified`. Khi chưa có record như vậy, UI hiển
thị trạng thái trống và không thay bằng số mẫu.

## Chạy cục bộ

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Các API AI/lead cần secret hoặc binding thật mới hoạt động đầy đủ. Không commit
`.env.local`, API key, dữ liệu khách hàng hoặc file CCCD.

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run build:vinext
```

## Kiến trúc triển khai

- Frontend/API: Next App Router chạy qua Vinext trên Cloudflare Worker.
- D1: catalog, provenance, review queue, leads, consent, outbox và audit.
- Telegram Bot `sendDocument`: CCCD tùy chọn được gửi trực tiếp sau consent riêng;
  D1 chỉ lưu metadata giao nhận, không lưu bytes ảnh.
- Queue: outbox lead, retry và dead-letter.
- Worker ingestor: robots/terms gate, crawler có ETag/Last-Modified, observation
  bất biến và human review; không tự publish lãi suất.
- Telegram: nhận mã lead/metadata đã loại PII; chỉ nhận ảnh CCCD khi khách đồng ý
  riêng. Telegram Bot không mã hóa đầu cuối và không bảo đảm thu hồi ảnh đã gửi.

Chi tiết nằm trong:

- [Kiến trúc](docs/ARCHITECTURE.md)
- [Deploy Cloudflare](docs/CLOUDFLARE_DEPLOY.md)
- [Nguồn dữ liệu và xác minh](docs/DATA_SOURCES.md)
- [Công thức tài chính](docs/FINANCIAL_CALCULATION.md)
- [Bảo mật và quyền riêng tư](docs/SECURITY_PRIVACY.md)
- [QA và giới hạn](docs/QA_REPORT.md)
- [Trạng thái triển khai](docs/IMPLEMENTATION_STATUS.md)
- [Third-party notices](docs/THIRD_PARTY_LICENSES.md)

## Deploy

Deploy production chạy từ nhánh `master` qua GitHub Actions sau khi validation
pass. Tài khoản Cloudflare, D1/Queue, secrets và quyền Telegram không chứa
trong repository. Xem [CLOUDFLARE_DEPLOY.md](docs/CLOUDFLARE_DEPLOY.md).

## Giấy phép

Repository hiện chưa có file license được xác nhận từ chủ sở hữu. Không nên
phân phối lại code, logo, mascot hoặc dữ liệu nguồn ngoài phạm vi repository
cho đến khi quyền sử dụng được xác nhận.
