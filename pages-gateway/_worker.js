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
const ASSET_VERSION = "safari-hydration-20261019";
const I18N_CLIENT_ASSET_PREFIX = "/_next/static/chunks/I18nProvider-";
const I18N_CLIENT_ASSET_MARKER = "function f({children:e})";
const I18N_CLIENT_ASSET_END = "function p()";
const I18N_CLIENT_ASSET_REPLACEMENT =
  'function f({children:e}){let[t,n]=(0,i.useState)("en");l(()=>{try{let e=localStorage.getItem(c)||localStorage.getItem("vaya_lang");if(e==="en"||e==="vi"||e==="zh"){n(e);document.documentElement.lang=e}}catch{}},[]);let o=(0,i.useCallback)(e=>{n(e);try{localStorage.setItem(c,e)}catch{}if(typeof document!=="undefined")document.documentElement.lang=e},[]),f=(0,i.useCallback)(e=>{let n=d(t,e);return typeof n==="string"?n:""},[t]),p=(0,i.useCallback)(e=>d(t,e),[t]);return(0,s.jsx)(u.Provider,{value:{lang:t,setLang:o,t:f,tRaw:p},children:e})}';

class StaticAssetAttributeRewriter {
  constructor(attribute) {
    this.attribute = attribute;
  }

  element(element) {
    const asset = element.getAttribute(this.attribute);
    if (!asset || !asset.startsWith("/_next/static/") || asset.includes("gateway=")) return;
    element.setAttribute(
      this.attribute,
      asset + (asset.includes("?") ? "&" : "?") + "gateway=" + ASSET_VERSION,
    );
  }
}

async function normalizeStaticAssetResponse(request, response) {
  const currentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (currentType.startsWith("text/html")) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Cache-Control", "no-store, must-revalidate");
    headers.delete("Content-Length");
    const htmlResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    return new HTMLRewriter()
      .on("script", new StaticAssetAttributeRewriter("src"))
      .on("link", new StaticAssetAttributeRewriter("href"))
      .transform(htmlResponse);
  }
  const pathname = new URL(request.url).pathname.toLowerCase();
  if (pathname.startsWith(I18N_CLIENT_ASSET_PREFIX.toLowerCase()) && pathname.endsWith(".js")) {
    const source = await response.text();
    const start = source.indexOf(I18N_CLIENT_ASSET_MARKER);
    const end = source.indexOf(I18N_CLIENT_ASSET_END, start);
    if (start >= 0 && end > start) {
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "text/javascript; charset=utf-8");
      headers.set("Cache-Control", "no-store, must-revalidate");
      return new Response(
        source.slice(0, start) + I18N_CLIENT_ASSET_REPLACEMENT + source.slice(end),
        { status: response.status, statusText: response.statusText, headers },
      );
    }
    return new Response(source, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  if (currentType && !currentType.startsWith("application/octet-stream")) return response;

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
    return await normalizeStaticAssetResponse(request, response);
  },
};

export default gateway;
