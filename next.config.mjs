/** @type {import('next').NextConfig} */
// Vinext must see Cloudflare's native `cloudflare:workers` module. The
// regular Next build has no Workers runtime, so it receives a build-time shim
// and returns an empty binding set (degraded APIs are intentional locally).
const isVinext = process.argv.some((argument) => /(?:vite|vinext)/i.test(argument));
const workerShim = "./src/lib/cloudflare/next-workers-shim.ts";

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  ...(isVinext
    ? {}
    : {
        turbopack: {
          resolveAlias: {
            "@/lib/cloudflare/worker-env": workerShim,
          },
        },
        webpack(config) {
          config.resolve.alias = {
            ...(config.resolve.alias ?? {}),
            "@/lib/cloudflare/worker-env": new URL(
              workerShim,
              import.meta.url,
            ).pathname,
          };
          return config;
        },
      }),
};

export default nextConfig;
