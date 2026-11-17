// Compares lib/sample/passport.json with a fresh export from the database
// (scripts/export-sample-fixture.sql), ignoring created_at timestamps and the
// _note. Fails if the committed fixture has drifted from supabase/seed.sql.
//
// Usage: node scripts/compare-fixture.mjs <exported.json>
import { readFileSync } from "node:fs";

const strip = (v) => {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v).filter(([k]) => k !== "created_at" && k !== "_note")
        .sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, strip(x)]),
    );
  }
  // 1110000.00 and 1110000 are the same amount.
  return typeof v === "number" ? Number(v) : v;
};

const committed = strip(JSON.parse(readFileSync(new URL("../lib/sample/passport.json", import.meta.url))));
const exported = strip(JSON.parse(readFileSync(process.argv[2], "utf8")));

const diffs = [];
(function walk(a, b, path) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`);
  } else diffs.push(path);
})(committed, exported, "passport");

if (diffs.length) {
  console.error("lib/sample/passport.json differs from the database export at:\n" + diffs.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("OK: sample fixture matches the public views built from supabase/seed.sql");
