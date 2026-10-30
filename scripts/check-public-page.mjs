// Privacy check for the public Passport page (backlog item 17).
// Starts the production build, fetches /p/<sample slug>, and fails if any
// PRIVATE value from supabase/seed.sql appears in the HTML.
//
// Usage: npm run build && npm run check:public-page
import { spawn } from "node:child_process";

const PORT = 3999;
const URL_ = `http://localhost:${PORT}/p/sample-kibira-classroom-block`;

// Private values in the fictional seed (people's full names and contacts,
// donor identity, supplier contacts and bank note, payment references,
// org registration/contacts, private file paths, the private photo,
// verification notes and declaration text).
const PRIVATE_VALUES = [
  "Samuel Okello", "Grace Auma", "Ruth Nambozo", "Fictional Donor",
  "Fictional Shopkeeper", "Fictional Head Teacher", "Fictional Foreman",
  "Head teacher, Kibira", "Church treasurer",
  "@hillside-hope.example", "@verifier.example", "@giving.example",
  "@hardware.example", "@kibira-ps.example", "@partner.example",
  "555 01", "Fictional Partner Church", "SAMPLE-GIFT", "SAMPLE-MM", "SAMPLE-BT",
  "SAMPLE-REG", "SAMPLE account", "P.O. Box 0",
  "sample/bank-statement-feb.pdf", "sample/roofing-invoice.pdf",
  "sample/first-day.jpg", "Pupils in the new classroom",
  "Visited the site; both rooms", "I have no family, financial",
];

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch {} };

let html = "";
try {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(URL_);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!html) throw new Error(`Could not load ${URL_}`);
  if (!html.includes("Kingdom Return")) throw new Error("Page loaded but looks incomplete");

  const leaks = PRIVATE_VALUES.filter((v) => html.includes(v));
  if (leaks.length) {
    console.error("PRIVATE values found on the public page:\n" + leaks.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`OK: none of ${PRIVATE_VALUES.length} private sample values appear on ${URL_}`);
  }
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  stop();
}
