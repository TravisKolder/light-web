// Build-output secret scan (backlog item 24, site review S6).
// Fails if anything that looks like a Supabase service/secret key, or a
// private-key block, ended up in the files sent to browsers (.next/static),
// or if browser source maps were published.
//
// Usage: npm run build && npm run check:build-output
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static";
if (!existsSync(ROOT)) {
  console.error(`${ROOT} not found: run "npm run build" first.`);
  process.exit(1);
}

const PATTERNS = [
  [/service_role/, "the string service_role"],
  [/sb_secret_[A-Za-z0-9_-]{8,}/, "a Supabase secret key (sb_secret_…)"],
  [/SUPABASE_SERVICE/i, "a service-key variable name"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key block"],
];

// A JWT whose payload says role: service_role.
function serviceJwt(text) {
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      if (JSON.parse(Buffer.from(m[1], "base64url").toString()).role === "service_role") return true;
    } catch {}
  }
  return false;
}

const problems = [];
let files = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    files += 1;
    if (name.endsWith(".js.map")) problems.push(`${path}: browser source map published`);
    if (!/\.(js|css|json|html|txt|map)$/.test(name)) continue;
    const text = readFileSync(path, "utf8");
    for (const [re, what] of PATTERNS) if (re.test(text)) problems.push(`${path}: contains ${what}`);
    if (serviceJwt(text)) problems.push(`${path}: contains a service_role JWT`);
  }
})(ROOT);

if (problems.length) {
  console.error("Build output problems:\n" + problems.join("\n"));
  process.exit(1);
}
console.log(`OK: no secrets or source maps in ${files} browser files under ${ROOT}`);
