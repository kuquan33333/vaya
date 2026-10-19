# Deploy Cloudflare từ GitHub

## Tài nguyên cần tạo

Tạo hoặc liên kết các resource sau trong đúng account:

- Worker `vaytiendanang`;
- Worker `vaytiendanang-ingestor`;
- D1 `vaytiendanang-db`;
- R2 `vaytiendanang-lead-documents` (private);
- Queue `vaytiendanang-lead-notifications` và DLQ tương ứng.

Migration `0001`–`0007` tạo cả `policy_chunks`, `rate_history` và crawler alert
outbox; không seed lãi suất hay banner giả.

Tên binding đã khai báo trong `cloudflare.config.ts` và
`workers/ingestor/cloudflare.config.ts`. Nếu account dùng tên khác, sửa cả
config và tài liệu trước khi migrate.

## Secrets/permissions cần cung cấp

GitHub Actions cần repository secrets:

- `CLOUDFLARE_API_TOKEN`: token đủ quyền deploy Worker, D1 migration, R2/Queue
  binding trong account đích;
- `CLOUDFLARE_ACCOUNT_ID`;
- `CLOUDFLARE_D1_DATABASE_ID`: database ID thật của D1 `vaytiendanang-db`.

Production Worker cần cấu hình:

- `DASHSCOPE_API_KEY` cho embedding RAG (bắt buộc), cùng
  `DASHSCOPE_EMBEDDING_MODEL`; thêm `DASHSCOPE_API_KEY` hoặc
  `DEEPSEEK_API_KEY` cho chat, cùng model/base URL tương ứng;
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`;
- `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`;
- `DOCUMENT_UPLOAD_SIGNING_KEY` chỉ khi bật upload;
- `DOCUMENT_UPLOADS_ENABLED=false` mặc định;
- `ZALO_CONTACT_URL` là URL HTTPS thật để health gate xác nhận CTA liên hệ;
- `PUBLIC_SITE_URL` để link hồ sơ nội bộ trong Telegram;
- `STAFF_ACCESS_TEAM_DOMAIN` và `STAFF_ACCESS_AUD` cho Cloudflare Access;
- `CRAWLER_TRIGGER_TOKEN` nếu cần trigger crawler thủ công đã xác thực.
- `CLOUDFLARE_D1_DATABASE_ID` không đưa vào client.

D1 migration CLI nhận database ID, không nhận binding name. Ingestor cũng cần
các secret runtime `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
`PUBLIC_SITE_URL` và `CRAWLER_TRIGGER_TOKEN` (nếu dùng trigger thủ công); app
Worker cần các secret AI/lead/Access tương ứng ở trên.

Không đặt secret vào `NEXT_PUBLIC_*`, source code, migration, log hoặc Telegram.

## Migration và deploy thủ công

Sau khi D1 đã tồn tại, chạy từ root repository:

```bash
npm ci
export CLOUDFLARE_D1_DATABASE_ID=<d1-database-id>
npx cf d1 migrations apply "$CLOUDFLARE_D1_DATABASE_ID" --remote
npx cf deploy --config cloudflare.config.ts
(cd workers/ingestor && npx cf deploy --config cloudflare.config.ts)
```

R2 không bật public bucket/r2.dev. Tạo Access application/policy allowlist cho
`/staff/*` và `/api/staff/*`, rồi đặt team domain + application audience vào
`STAFF_ACCESS_TEAM_DOMAIN`/`STAFF_ACCESS_AUD`. Telegram link sẽ mở đúng một
hồ sơ opaque, không có danh sách Admin.

Chỉ bật một `data_sources.crawl_enabled` sau khi nhân sự đã kiểm tra và ghi
`robots_status='allowed'`, `terms_status='allowed'`. Seed provider registry
không phải seed rate.

Trigger crawl thủ công (không public nếu thiếu token):

```bash
curl -fsS -X POST https://<ingestor-domain>/internal/crawl \
  -H "Authorization: Bearer $CRAWLER_TRIGGER_TOKEN"
```

Endpoint này chỉ nhận token secret của ingestor, không có UI/admin listing và
không bypass robots/terms. Cron vẫn là luồng mặc định.

Review observation không qua Admin UI:

```bash
CATALOG_REVIEW_ACTOR=ops@example.test npm run catalog:review -- approve --review-id <id>
CATALOG_REVIEW_ACTOR=ops@example.test npm run catalog:review -- reject --review-id <id>
CATALOG_REVIEW_ACTOR=ops@example.test npm run catalog:review -- publish \
  --review-id <id> --entity-type product --entity-id <product-id>
```

Các lệnh trên cần `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` và
`CLOUDFLARE_D1_DATABASE_ID`, chỉ cho phép publish entity khớp review item đã
approved và ghi audit. `product_term` và `rate_history` cũng chỉ được ghi
vào bảng canonical sau khi publish. Reviewer vẫn phải đối chiếu đầy đủ source,
basis, phí và post-promo trước khi approve.

Nhập một batch dữ liệu được cung cấp hợp pháp (luôn ở quarantine):

```bash
CATALOG_IMPORT_ACTOR=ops npm run catalog:import -- --file ./batch.json
```

Sau khi review source/provider, dùng `activate-provider` để mở provider và
`enable-source` chỉ khi robots + terms đã được ghi là `allowed`. Product/rate/
promotion/banner vẫn phải publish riêng từ review item tương ứng.

## GitHub Actions

`.github/workflows/deploy-cloudflare.yml` chạy lint, typecheck, unit tests và
hai build. Job production chỉ chạy khi push vào `master`; pull request chỉ
chạy validation, không thay đổi Cloudflare. Production health gate yêu cầu
`PUBLIC_SITE_URL`, nên workflow không thể vô tình báo deploy thành công khi
chưa có URL để kiểm tra.

## Kiểm tra sau deploy

```bash
curl -fsS https://<domain>/api/health
curl -fsS https://<domain>/api/catalog
```

`/api/health` chỉ trả HTTP 200/ `ok` khi các thành phần production bắt buộc
(D1, Queue, chat + embedding AI, Telegram, Turnstile, Zalo, Public URL và
Cloudflare Access) đã cấu hình; R2 document là tùy chọn và mặc định tắt.
Catalog rỗng là trạng thái an toàn cho đến khi record được review và publish.
Kiểm tra Cloudflare Logs, D1 `notification_outbox` và Queue DLQ sau lead test
thật.
