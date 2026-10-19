import type { R2Bucket } from "@cloudflare/workers-types";

export interface StaffAccessRuntime {
  STAFF_ACCESS_TEAM_DOMAIN?: string;
  STAFF_ACCESS_AUD?: string;
}

export interface StaffIdentity {
  subject: string;
  email: string | null;
  name: string | null;
}

type AccessJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
type AccessCertResponse = { keys?: AccessJwk[] };

let cachedCertificates: { expiresAt: number; keys: AccessJwk[] } | null = null;

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeBase64UrlBuffer(value: string): ArrayBuffer {
  const bytes = decodeBase64Url(value);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function normalizedDomain(value: string): string {
  const withScheme = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
  return new URL(withScheme).origin;
}

async function accessKeys(domain: string): Promise<AccessJwk[]> {
  const now = Date.now();
  if (cachedCertificates && cachedCertificates.expiresAt > now) return cachedCertificates.keys;
  const response = await fetch(`${normalizedDomain(domain)}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("access_certs_unavailable");
  const body = (await response.json()) as AccessCertResponse;
  if (!body.keys?.length) throw new Error("access_certs_empty");
  cachedCertificates = { keys: body.keys, expiresAt: now + 10 * 60 * 1000 };
  return body.keys;
}

function audienceMatches(value: unknown, expected: string): boolean {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

/** Verify a Cloudflare Access JWT; absence/mismatch always denies staff access. */
export async function verifyStaffAccess(
  request: Request,
  runtime: StaffAccessRuntime,
): Promise<StaffIdentity | null> {
  const domain = runtime.STAFF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = runtime.STAFF_ACCESS_AUD?.trim();
  const assertion = request.headers.get("CF-Access-Jwt-Assertion");
  if (!domain || !audience || !assertion) return null;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = assertion.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
    const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader);
    if (header.alg !== "RS256" || !header.kid) return null;
    const payload = decodeJson<{
      aud?: unknown;
      iss?: string;
      exp?: number;
      sub?: string;
      email?: string;
      name?: string;
    }>(encodedPayload);
    const issuer = normalizedDomain(domain);
    if (payload.iss !== issuer || !audienceMatches(payload.aud, audience) || !payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const jwk = (await accessKeys(issuer)).find((key) => key.kid === header.kid);
    if (!jwk) return null;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      decodeBase64UrlBuffer(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (!verified) return null;
    return { subject: payload.sub, email: payload.email ?? null, name: payload.name ?? null };
  } catch {
    return null;
  }
}

export async function hashStaffSubject(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subject));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type StaffStorage = Pick<R2Bucket, "get" | "delete">;
