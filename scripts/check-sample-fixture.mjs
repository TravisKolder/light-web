// Fails if the sample fixture contains any key that names a private field.
// The fixture is generated from public views, so this should never trip;
// it guards against someone hand-editing private data into it.
import { readFileSync } from "node:fs";

const PRIVATE_KEYS = [
  /^gps_/, /^donor_/, /^contact_/, /^reference_number$/, /^full_name$/,
  /^email$/, /^phone$/, /^address/, /^notes$/, /^uploaded_by$/,
  /^registration_number$/, /^bank_details/, /^independence_declaration$/,
  /^asserted_by$/, /^verifier_id$/, /^author_id$/, /^shows_identifiable_people$/,
];

const data = JSON.parse(readFileSync(new URL("../lib/sample/passport.json", import.meta.url)));
const found = [];
(function walk(v, path) {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (PRIVATE_KEYS.some((re) => re.test(k))) found.push(`${path}.${k}`);
      walk(x, `${path}.${k}`);
    }
})(data, "passport");

if (found.length) {
  console.error("Private-looking fields in lib/sample/passport.json:\n" + found.join("\n"));
  process.exit(1);
}
console.log("OK: sample fixture has no private fields");
