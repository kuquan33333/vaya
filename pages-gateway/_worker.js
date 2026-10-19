/**
 * Pages Functions advanced-mode gateway.
 * The Pages project remains the public hostname; application execution stays
 * in the dedicated Vinext Worker through the APP Service Binding.
 */
const gateway = {
  async fetch(request, env, ctx) {
    if (!env.APP || typeof env.APP.fetch !== "function") {
      return new Response("Pages gateway Service Binding APP is not configured", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return env.APP.fetch(request, env, ctx);
  },
};

export default gateway;
