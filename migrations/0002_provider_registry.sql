INSERT OR IGNORE INTO providers
  (provider_id, provider_slug, legal_name, display_name_vi, display_name_en, display_name_zh,
   lender_type, official_url, status, source_url, notes)
VALUES
  ('provider:vietcombank', 'vietcombank', 'Vietcombank', 'Vietcombank', 'Vietcombank', 'Vietcombank', 'bank', 'https://www.vietcombank.com.vn/', 'pending_verification', 'https://www.vietcombank.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:bidv', 'bidv', 'BIDV', 'BIDV', 'BIDV', 'BIDV', 'bank', 'https://www.bidv.com.vn/', 'pending_verification', 'https://www.bidv.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:techcombank', 'techcombank', 'Techcombank', 'Techcombank', 'Techcombank', 'Techcombank', 'bank', 'https://www.techcombank.com/', 'pending_verification', 'https://www.techcombank.com/', 'Provider registry; product terms require source verification.'),
  ('provider:vpbank', 'vpbank', 'VPBank', 'VPBank', 'VPBank', 'VPBank', 'bank', 'https://www.vpbank.com.vn/', 'pending_verification', 'https://www.vpbank.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:mb-bank', 'mb-bank', 'MB Bank', 'MB Bank', 'MB Bank', 'MB Bank', 'bank', 'https://www.mbbank.com.vn/', 'pending_verification', 'https://www.mbbank.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:acb', 'acb', 'ACB', 'ACB', 'ACB', 'ACB', 'bank', 'https://www.acb.com.vn/', 'pending_verification', 'https://www.acb.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:vib', 'vib', 'VIB', 'VIB', 'VIB', 'VIB', 'bank', 'https://www.vib.com.vn/', 'pending_verification', 'https://www.vib.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:tpbank', 'tpbank', 'TPBank', 'TPBank', 'TPBank', 'TPBank', 'bank', 'https://tpb.vn/', 'pending_verification', 'https://tpb.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:sacombank', 'sacombank', 'Sacombank', 'Sacombank', 'Sacombank', 'Sacombank', 'bank', 'https://www.sacombank.com.vn/', 'pending_verification', 'https://www.sacombank.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:hdbank', 'hdbank', 'HDBank', 'HDBank', 'HDBank', 'HDBank', 'bank', 'https://www.hdbank.com.vn/', 'pending_verification', 'https://www.hdbank.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:vietinbank', 'vietinbank', 'VietinBank', 'VietinBank', 'VietinBank', 'VietinBank', 'bank', 'https://www.vietinbank.vn/', 'pending_verification', 'https://www.vietinbank.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:agribank', 'agribank', 'Agribank', 'Agribank', 'Agribank', 'Agribank', 'bank', 'https://www.agribank.com.vn/', 'pending_verification', 'https://www.agribank.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:shb', 'shb', 'SHB', 'SHB', 'SHB', 'SHB', 'bank', 'https://www.shb.com.vn/', 'pending_verification', 'https://www.shb.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:msb', 'msb', 'MSB', 'MSB', 'MSB', 'MSB', 'bank', 'https://www.msb.com.vn/', 'pending_verification', 'https://www.msb.com.vn/', 'Provider registry; product terms require source verification.'),
  ('provider:home-credit', 'home-credit', 'Home Credit Vietnam Finance Company Limited', 'Home Credit', 'Home Credit', 'Home Credit', 'consumer-finance', 'https://www.homecredit.vn/', 'pending_verification', 'https://www.homecredit.vn/', 'Allowlisted official source; product terms not published until verified.'),
  ('provider:fe-credit', 'fe-credit', 'FE CREDIT', 'FE CREDIT', 'FE CREDIT', 'FE CREDIT', 'consumer-finance', 'https://fecredit.com.vn/', 'pending_verification', 'https://fecredit.com.vn/', 'Allowlisted official source; product terms not published until verified.'),
  ('provider:hd-saison', 'hd-saison', 'HD SAISON Finance Company Limited', 'HD SAISON', 'HD SAISON', 'HD SAISON', 'consumer-finance', 'https://www.hdsaison.com.vn/', 'pending_verification', 'https://www.hdsaison.com.vn/', 'Allowlisted official source; product terms not published until verified.'),
  ('provider:shb-finance', 'shb-finance', 'SHB Finance Company Limited', 'SHBFinance', 'SHBFinance', 'SHBFinance', 'consumer-finance', 'https://www.shbfinance.com.vn/', 'pending_verification', 'https://www.shbfinance.com.vn/', 'Allowlisted official source; product terms not published until verified.'),
  ('provider:mcredit', 'mcredit', 'Mcredit', 'Mcredit', 'Mcredit', 'Mcredit', 'consumer-finance', 'https://mcredit.vn/', 'pending_verification', 'https://mcredit.vn/', 'Allowlisted official source; product terms not published until verified.'),
  ('provider:mirae-asset-finance', 'mirae-asset-finance', 'Mirae Asset Finance Vietnam', 'Mirae Asset Finance', 'Mirae Asset Finance', 'Mirae Asset Finance', 'consumer-finance', 'https://miraeasset.com.vn/', 'pending_verification', 'https://miraeasset.com.vn/', 'Allowlisted official source; product terms not published until verified.');

INSERT OR IGNORE INTO data_sources
  (source_id, provider_id, source_url, source_type, robots_status, terms_status, crawl_enabled, user_agent, notes)
SELECT
  'source:' || provider_id,
  provider_id,
  official_url,
  'html',
  'unknown',
  'unknown',
  0,
  'vaytiendanang-data-bot/1.0 (+contact configured out of band)',
  'Crawl remains disabled until robots.txt and terms are checked and recorded.'
FROM providers;
