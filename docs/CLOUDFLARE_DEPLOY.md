# Deploy Cloudflare từ GitHub

## Kiến trúc production

- `vaytiendanang` là Worker chạy Next.js/Vinext, giữ toàn bộ UI, AI, D1 và
  API.
- `vaytiendanang-ingestor` là Worker cron/Queue cho crawler, outbox Telegram
  và dead-letter queue.
- Pages project hiện hữu `vaytiendanang` (`vaytiendanang.pages.dev`) chỉ là
  gateway Pages Functions. Gateway dùng Service Binding `APP` tới Worker
  `vaytiendanang`; không tạo Pages project mới.
- D1 `vaytiendanang-db` lưu catalog/provenance/review/lead/consent/audit và
  metadata giao CCCD. Queue `vaytiendanang-lead-notifications` có DLQ tương
  ứng.
- Không dùng R2. CCCD được kiểm tra rồi gửi trực tiếp bằng Telegram Bot
  `sendDocument`; bytes ảnh không đi vào D1, Worker storage hay object storage.

## Secrets và quyền cần cung cấp

GitHub Actions production/staging cần:

- `CLOUDFLARE_API_TOKEN`: token giới hạn trong account đích, có Workers Scripts
  Edit, Pages Edit, D1 Edit, Queues Edit và Account Settings Read nếu Wrangler
  yêu cầu; không cấp R2;
- `CLOUDFLARE_ACCOUNT_ID`;
- `CLOUDFLARE_D1_DATABASE_ID` của D1 production `vaytiendanang-db`;
- `CLOUDFLARE_STAGING_D1_DATABASE_ID` của D1 staging;
- `PUBLIC_SITE_URL=https://vaytiendanang.pages.dev`;
- `STAGING_PUBLIC_SITE_URL` là URL gateway preview/staging dùng cho smoke test.

Các tên trên phải được thêm tại GitHub repository **Settings → Secrets and
variables → Actions**. Không ghi token vào source, workflow log hoặc file
`.env` commit vào repository.

Runtime app Worker cần:

- `DASHSCOPE_API_KEY`, `DASHSCOPE_EMBEDDING_MODEL` và model/base URL tương ứng;
  hoặc DeepSeek cho chat theo cấu hình;
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` và
  `DOCUMENT_UPLOAD_SIGNING_KEY`;
- `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`;
- `ZALO_CONTACT_URL` là HTTPS thật;
- `STAFF_ACCESS_TEAM_DOMAIN`, `STAFF_ACCESS_AUD`;
- `PUBLIC_SITE_URL`.

Ingestor cần `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PUBLIC_SITE_URL` và
`CRAWLER_TRIGGER_TOKEN` nếu dùng trigger thủ công. Không đặt secret trong
`NEXT_PUBLIC_*`, source, migration, log hoặc caption chứa PII.

Telegram phải cho bot truy cập chat đích. Route CCCD gọi `getMe` và `getChat`
trước khi đọc multipart; token/chat không hợp lệ thì trả lỗi và không nhận ảnh.
Bot Telegram không mã hóa đầu cuối; ảnh sau khi gửi không bảo đảm thu hồi hoàn
toàn.

## Migration và deploy

Workflow `.github/workflows/deploy-cloudflare.yml` chạy một pipeline gồm
validation, D1 migration, app Worker, ingestor Worker, Pages gateway và smoke
health. `staging` dùng environment/Worker target riêng; production chỉ chạy khi
push `master` hoặc được gọi thủ công. Mọi binding Pages đều trỏ vào project
`vaytiendanang` hiện hữu.

Các bước thủ công tương đương:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run build:vinext
npx cf deploy
(cd workers/ingestor && npx cf deploy)
node scripts/configure-pages-gateway.mjs
node scripts/deploy-pages-gateway.mjs
```

Sau deploy, Pages project phải có Service Binding:

```text
APP -> service vaytiendanang
```

Không thay thế bằng URL fetch công khai và không tạo project Pages thứ hai.

## Dữ liệu crawler và catalog

Chỉ bật `data_sources.crawl_enabled` sau khi reviewer ghi
`robots_status='allowed'`, `terms_status='allowed'`. Observation mới đi qua
review queue; không tự publish rate/product/promotion/banner.

Trigger crawler thủ công (nếu đã cấu hình token):

```bash
curl -fsS -X POST https://<ingestor-domain>/internal/crawl \
  -H "Authorization: Bearer $CRAWLER_TRIGGER_TOKEN"
```

## Smoke test bắt buộc

```bash
curl -i https://vaytiendanang.pages.dev/
curl -i https://vaytiendanang.pages.dev/api/health
curl -i https://vaytiendanang.pages.dev/api/catalog
```

`/api/health` chỉ HTTP 200 khi D1, Queue, chat/embedding AI, Telegram
(`getMe/getChat`), Turnstile, Zalo, Public URL và Cloudflare Access đều đã cấu
hình. Health degraded là failure gate, không được báo production hoàn tất.
Catalog rỗng là trạng thái an toàn nếu chưa có dữ liệu verified.

Lead/CCCD thật cần kiểm thử với consent, upload token, cả hai mặt, định dạng/
dung lượng sai và Telegram response lỗi. Không dùng ảnh hoặc Telegram giả để
thay cho smoke test production.
