export interface CrawlSource {
  source_id: string;
  provider_id: string;
  source_url: string;
  source_type: "html" | "json" | "pdf" | "manual";
  robots_status: "allowed" | "disallowed" | "unknown";
  terms_status: "allowed" | "restricted" | "unknown";
  crawl_enabled: number;
  user_agent: string | null;
  etag: string | null;
  last_modified: string | null;
  previous_content_hash: string | null;
}

export interface CrawlObservation {
  httpStatus: number | null;
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
  parserVersion: string;
  extracted: {
    title: string | null;
    canonicalUrl: string;
    textSample: string;
    candidateSignals: string[];
  };
  validationStatus: "valid" | "invalid" | "blocked" | "stale" | "anomaly";
  errorMessage: string | null;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const PARSER_VERSION = "vaytiendanang-crawler-1";

function normalizedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

/** A conservative robots parser: disallow wins unless a longer allow matches. */
export function robotsAllows(robotsText: string, targetUrl: string, userAgent: string): boolean {
  const target = normalizedUrl(targetUrl);
  if (!target) return false;
  const rules: { path: string; allow: boolean }[] = [];
  let applies = false;
  let sawRuleForBot = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      const bot = value.toLowerCase();
      applies = bot === "*" || userAgent.toLowerCase().includes(bot);
      if (applies) sawRuleForBot = true;
      continue;
    }
    if (!applies || (field !== "allow" && field !== "disallow")) continue;
    if (field === "disallow" && value === "") continue;
    rules.push({ path: value, allow: field === "allow" });
  }
  if (!sawRuleForBot) return true;
  const matching = rules
    .filter((rule) => target.pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length);
  return matching[0]?.allow ?? true;
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const value = match ? stripMarkup(match[1]) : "";
  return value ? value.slice(0, 240) : null;
}

export function extractCandidateSignals(text: string): string[] {
  const signals: string[] = [];
  const patterns: [string, RegExp][] = [
    ["rate", /(lãi suất|lai suat|interest rate|%\s*\/\s*năm|%\s*\/\s*nam)/i],
    ["amount", /(hạn mức|han muc|khoản vay|khoan vay|amount|vnd)/i],
    ["term", /(thời hạn|thoi han|kỳ hạn|ky han|term|months?)/i],
    ["fee", /(phí|phi|fee|insurance|bảo hiểm|bao hiem)/i],
    ["eligibility", /(điều kiện|dieu kien|eligib|hồ sơ|ho so|document)/i],
  ];
  for (const [name, pattern] of patterns) if (pattern.test(text)) signals.push(name);
  return signals;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readBoundedBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new Error("response_too_large");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_BODY_BYTES) throw new Error("response_too_large");
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchSource(source: CrawlSource, fetchImpl = fetch): Promise<CrawlObservation> {
  if (source.crawl_enabled !== 1 || source.robots_status !== "allowed" || source.terms_status !== "allowed") {
    return {
      httpStatus: null,
      etag: source.etag,
      lastModified: source.last_modified,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extracted: { title: null, canonicalUrl: source.source_url, textSample: "", candidateSignals: [] },
      validationStatus: "blocked",
      errorMessage: "source_not_allowlisted_for_crawl",
    };
  }
  const url = normalizedUrl(source.source_url);
  if (!url) {
    return {
      httpStatus: null,
      etag: null,
      lastModified: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extracted: { title: null, canonicalUrl: source.source_url, textSample: "", candidateSignals: [] },
      validationStatus: "invalid",
      errorMessage: "source_url_invalid",
    };
  }
  if (source.source_type !== "html" && source.source_type !== "json") {
    return {
      httpStatus: null,
      etag: null,
      lastModified: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extracted: { title: null, canonicalUrl: url.toString(), textSample: "", candidateSignals: [] },
      validationStatus: "invalid",
      errorMessage: "unsupported_source_type_requires_manual_review",
    };
  }

  const robotUrl = new URL("/robots.txt", url);
  let robotsResponse: Response;
  try {
    robotsResponse = await fetchImpl(robotUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return {
      httpStatus: null,
      etag: null,
      lastModified: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extracted: { title: null, canonicalUrl: url.toString(), textSample: "", candidateSignals: [] },
      validationStatus: "blocked",
      errorMessage: "robots_fetch_failed",
    };
  }
  if (!robotsResponse.ok || !robotsAllows(await robotsResponse.text(), url.toString(), source.user_agent ?? "vaytiendanang-data-bot")) {
    return {
      httpStatus: null,
      etag: null,
      lastModified: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extracted: { title: null, canonicalUrl: url.toString(), textSample: "", candidateSignals: [] },
      validationStatus: "blocked",
      errorMessage: "robots_disallow_or_unavailable",
    };
  }

  const headers = new Headers({
    "User-Agent": source.user_agent ?? "vaytiendanang-data-bot/1.0 (+contact configured out of band)",
    Accept: source.source_type === "json" ? "application/json" : "text/html,application/xhtml+xml",
  });
  if (source.etag) headers.set("If-None-Match", source.etag);
  if (source.last_modified) headers.set("If-Modified-Since", source.last_modified);
  let response: Response;
  try {
    response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    return {
      httpStatus: null,
      etag: null,
      lastModified: null,
      contentHash: null,
      parserVersion: PARSER_VERSION,
      extracted: { title: null, canonicalUrl: url.toString(), textSample: "", candidateSignals: [] },
      validationStatus: "stale",
      errorMessage: "source_fetch_failed",
    };
  }
  const common = {
    httpStatus: response.status,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    parserVersion: PARSER_VERSION,
    canonicalUrl: url.toString(),
  };
  if (response.status === 304) {
    return {
      ...common,
      contentHash: null,
      extracted: { title: null, canonicalUrl: common.canonicalUrl, textSample: "", candidateSignals: [] },
      validationStatus: "stale",
      errorMessage: "not_modified",
    };
  }
  if (!response.ok) {
    return {
      ...common,
      contentHash: null,
      extracted: { title: null, canonicalUrl: common.canonicalUrl, textSample: "", candidateSignals: [] },
      validationStatus: response.status === 403 || response.status === 429 ? "blocked" : "invalid",
      errorMessage: `http_${response.status}`,
    };
  }

  try {
    const body = await readBoundedBody(response);
    const text = source.source_type === "json" ? body.replace(/\s+/g, " ").trim() : stripMarkup(body);
    const sample = text.slice(0, 8_000);
    const signals = extractCandidateSignals(text);
    return {
      ...common,
      contentHash: await sha256(body),
      extracted: {
        title: source.source_type === "html" ? titleOf(body) : null,
        canonicalUrl: common.canonicalUrl,
        textSample: sample,
        candidateSignals: signals,
      },
      validationStatus: signals.includes("rate") ? "anomaly" : "valid",
      errorMessage: signals.includes("rate") ? "rate_signal_requires_human_review" : null,
    };
  } catch (error) {
    return {
      ...common,
      contentHash: null,
      extracted: { title: null, canonicalUrl: common.canonicalUrl, textSample: "", candidateSignals: [] },
      validationStatus: "invalid",
      errorMessage: error instanceof Error ? error.message : "body_parse_failed",
    };
  }
}
