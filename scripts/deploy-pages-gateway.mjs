import { readFile } from "node:fs/promises";

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT ?? "vaytiendanang";
const branch = process.env.CLOUDFLARE_PAGES_BRANCH ?? "master";
if (!token || !accountId) throw new Error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");

const form = new FormData();
form.append(
  "_worker.js",
  new Blob([await readFile(new URL("../pages-gateway/_worker.js", import.meta.url))], { type: "application/javascript+module" }),
  "_worker.js",
);
form.append(
  "_headers",
  new Blob([await readFile(new URL("../pages-gateway/_headers", import.meta.url))], { type: "text/plain" }),
  "_headers",
);
form.append("manifest", "{}");
form.append("branch", branch);
form.append("commit_dirty", process.env.GITHUB_ACTIONS === "true" ? "false" : "true");
if (process.env.GITHUB_SHA) form.append("commit_hash", process.env.GITHUB_SHA);
if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA) {
  form.append("commit_message", `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${process.env.GITHUB_SHA}`);
}
form.append("pages_build_output_dir", "pages-gateway");

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments`;
const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
const payload = await response.json();
if (!response.ok || payload.success !== true) {
  throw new Error(`Pages deployment failed (${response.status}): ${JSON.stringify(payload.errors ?? payload)}`);
}
console.log(JSON.stringify({
  id: payload.result?.id,
  url: payload.result?.url,
  environment: payload.result?.environment,
  stage: payload.result?.latest_stage,
}));
