/**
 * Pages Functions advanced-mode gateway.
 * The Pages project remains the public hostname; application execution stays
 * in the dedicated Vinext Worker through the APP Service Binding.
 */
const STATIC_MIME_TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function normalizeStaticAssetResponse(request, response) {
  const currentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (currentType && !currentType.startsWith("application/octet-stream")) return response;

  const pathname = new URL(request.url).pathname.toLowerCase();
  const dot = pathname.lastIndexOf(".");
  const mime = dot >= 0 ? STATIC_MIME_TYPES[pathname.slice(dot)] : undefined;
  if (!mime) return response;

  const headers = new Headers(response.headers);
  headers.set("Content-Type", mime);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const gateway = {
  async fetch(request, env, ctx) {
    if (!env.APP || typeof env.APP.fetch !== "function") {
      return new Response("Pages gateway Service Binding APP is not configured", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const response = await env.APP.fetch(request, env, ctx);
    return normalizeStaticAssetResponse(request, response);
  },
};

export default gateway;
