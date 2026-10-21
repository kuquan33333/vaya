-- Read-only robots checks performed on 2026-10-19 with the declared
-- vaytiendanang-data-bot user agent. Terms remain unknown, so no source is
-- enabled automatically by this migration.
UPDATE data_sources
SET robots_status = 'allowed',
    terms_status = 'unknown',
    notes = 'robots.txt returned HTTP 200 on 2026-10-19; terms/permission still require human confirmation; crawl remains disabled.'
WHERE source_id IN (
  'source:provider:home-credit',
  'source:provider:fe-credit',
  'source:provider:shb-finance',
  'source:provider:vietcombank',
  'source:provider:bidv',
  'source:provider:techcombank',
  'source:provider:vpbank'
);

UPDATE data_sources
SET robots_status = 'disallowed',
    terms_status = 'unknown',
    notes = 'robots.txt endpoint returned HTTP 403 on 2026-10-19; crawler remains disabled and does not bypass the block.'
WHERE source_id = 'source:provider:hd-saison';

UPDATE data_sources
SET robots_status = 'unknown',
    terms_status = 'unknown',
    notes = 'robots.txt could not be verified from the audit environment on 2026-10-19; crawler remains disabled.'
WHERE source_id IN ('source:provider:mcredit', 'source:provider:mirae-asset-finance');
