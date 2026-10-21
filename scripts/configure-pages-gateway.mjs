const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT ?? "vaytiendanang";
const serviceName = process.env.CF_APP_WORKER_NAME ?? "vaytiendanang";
const deploymentMode = process.env.CLOUDFLARE_PAGES_CONFIG ?? "production";
if (!token || !accountId) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");
if (!/^(production|preview)$/.test(deploymentMode)) throw new Error("CLOUDFLARE_PAGES_CONFIG must be production or preview");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function api(path, options = {}) {
  const response = await fetch(`${endpoint}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  const payload = await response.json();
  if (!response.ok || payload.success !== true) throw new Error(`Pages API failed (${response.status}): ${JSON.stringify(payload.errors ?? payload)}`);
  return payload.result;
}

const project = await api("");
const current = project.deployment_configs?.[deploymentMode] ?? {};
const services = { ...(current.services ?? {}), APP: { service: serviceName } };
const deploymentConfigs = {
  ...(project.deployment_configs ?? {}),
  [deploymentMode]: {
    ...current,
    services,
  },
};
await api("", {
  method: "PATCH",
  body: JSON.stringify({
    production_branch: project.production_branch ?? "master",
    deployment_configs: deploymentConfigs,
  }),
});
console.log(`Pages project ${projectName}: ${deploymentMode}.APP -> ${serviceName}`);
