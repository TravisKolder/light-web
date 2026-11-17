// Security header check (backlog item 24, site review S1/S6).
// Starts the production build and fails if any page is missing a security
// header, still sends x-powered-by, or has a weak Content-Security-Policy.
//
// Usage: npm run build && npm run check:headers
import { spawn } from "node:child_process";

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const PAGES = ["/", "/p", "/p/sample-kibira-classroom-block", "/edit", "/no-such-page"];

const REQUIRED = {
  "x-content-type-options": (v) => v === "nosniff",
  "referrer-policy": (v) => v === "strict-origin-when-cross-origin",
  "x-frame-options": (v) => v === "DENY",
  "permissions-policy": (v) => /camera=\(\)/.test(v) && /geolocation=\(\)/.test(v),
  "content-security-policy": (v) =>
    /default-src 'self'/.test(v) &&
    /script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/.test(v) &&
    !/script-src [^;]*'unsafe-inline'/.test(v) &&
    !/script-src [^;]*'unsafe-eval'/.test(v) &&
    /frame-ancestors 'none'/.test(v) &&
    /object-src 'none'/.test(v) &&
    /base-uri 'self'/.test(v) &&
    /form-action 'self'/.test(v),
};

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch {} };

const problems = [];
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { await fetch(BASE + "/"); up = true; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  if (!up) throw new Error("Server did not start");

  const nonces = new Set();
  for (const path of PAGES) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    for (const [name, ok] of Object.entries(REQUIRED)) {
      const v = res.headers.get(name);
      if (!v) problems.push(`${path}: missing ${name}`);
      else if (!ok(v)) problems.push(`${path}: unexpected ${name}: ${v}`);
    }
    if (res.headers.get("x-powered-by")) problems.push(`${path}: sends x-powered-by`);
    const nonce = res.headers.get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
    if (nonce) {
      if (nonces.has(nonce)) problems.push(`${path}: CSP nonce was reused`);
      nonces.add(nonce);
    }
  }

  if (problems.length) {
    console.error("Security header problems:\n" + problems.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`OK: security headers present and CSP strict on ${PAGES.length} pages`);
  }
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  stop();
}
