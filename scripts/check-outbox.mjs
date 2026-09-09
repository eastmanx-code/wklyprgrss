/**
 * Checks for the capture queue, against a real browser.
 *
 *   npm i --no-save playwright-core
 *   node scripts/check-outbox.mjs
 *
 * Run by hand, like check-sw.mjs, and for the same reason: IndexedDB does not
 * exist outside a browser and this is the code that decides whether a
 * photograph taken in a cellar survives to the morning.
 *
 * The case that matters is the one nobody can reproduce on a desk. Some
 * iPhones refuse to put a Blob in an object store — "Error preparing Blob/File
 * data to be stored in object store" — and the record caught it eleven times
 * in one night. That refusal is simulated here by making the store throw on
 * any Blob, exactly as WebKit does, and the queue has to keep the bytes anyway
 * and hand them back as a Blob that uploads.
 */
import http from "node:http";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.log("\n  needs a browser driver:  npm i --no-save playwright-core\n");
  process.exit(1);
}

const CHROME =
  process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const OUT = new URL("../.outbox-check/", import.meta.url);

// Compiled the same way the fixture leaves are, then given the .js the browser
// needs on its one relative import.
execFileSync("npx", [
  "tsc", "src/lib/outbox.ts", "src/lib/trouble.ts",
  "--outDir", ".outbox-check", "--module", "esnext", "--target", "es2022",
  "--moduleResolution", "bundler",
], { stdio: "inherit" });
for (const name of ["outbox.js", "trouble.js"]) {
  const path = new URL(name, OUT);
  fs.writeFileSync(path, fs.readFileSync(path, "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
}

const PAGE = `<!doctype html><html><body><script type="module">
  import * as outbox from "/outbox.js";
  window.outbox = outbox;
  window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(PAGE); }
  const file = new URL("." + req.url, OUT);
  if (fs.existsSync(file)) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(file)); }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(3997, r));

let pass = 0, fail = 0;
const is = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
};

const browser = await chromium.launch({ executablePath: CHROME });
const p = await browser.newPage();
p.on("pageerror", (e) => console.log("  pageerror:", e.message));
await p.goto("http://localhost:3997/");
await p.waitForFunction(() => window.ready === true);

/** A photograph's worth of bytes with a recognisable pattern in them. */
const SHOT = `new Blob([new Uint8Array(4096).map((_, i) => i % 251)], { type: "image/jpeg" })`;
const op = (key) => ({
  kind: "proof", key, slug: "foh-host-close", itemId: "item", shotIndex: 0,
  shot: "photo", extension: "", initials: "RB", bytes: 4096, clientAt: new Date().toISOString(),
});

// --------------------------------------------------- the ordinary phone

{
  const r = await p.evaluate(async (op) => {
    const held = await outbox.enqueueProof(op, eval(op.blobSrc));
    const back = await outbox.blobFor(op.key);
    const bytes = new Uint8Array(await back.arrayBuffer());
    return { held, type: back.type, size: back.size, sample: [bytes[0], bytes[1], bytes[250], bytes[251]] };
  }, { ...op("a"), blobSrc: SHOT });
  is("a blob goes in the ordinary way", r.held, { stored: true });
  is("and comes back the same type", r.type, "image/jpeg");
  is("and the same size", r.size, 4096);
  is("and the same bytes", r.sample, [0, 1, 250, 0]);
}

// ---------------------------------------------- the phone that refuses
//
// WebKit's refusal, reproduced: the store throws on any Blob and takes
// anything else. This is the shape of the fault the record caught.

await p.evaluate(() => {
  const real = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (value instanceof Blob) {
      throw new DOMException("Error preparing Blob/File data to be stored in object store", "UnknownError");
    }
    return real.call(this, value, key);
  };
});

{
  const r = await p.evaluate(async (op) => {
    const held = await outbox.enqueueProof(op, eval(op.blobSrc));
    const back = await outbox.blobFor(op.key);
    const bytes = new Uint8Array(await back.arrayBuffer());
    const pending = await outbox.pending();
    return {
      stored: held.stored, fellBack: held.fellBack,
      isBlob: back instanceof Blob, type: back.type, size: back.size,
      sample: [bytes[0], bytes[1], bytes[250], bytes[251]], pending,
    };
  }, { ...op("b"), blobSrc: SHOT });
  is("a refused blob is still kept", r.stored, true);
  is("and says how", r.fellBack, "UnknownError: Error preparing Blob/File data to be stored in object store");
  is("it comes back as a Blob", r.isBlob, true);
  is("with its type, which a buffer alone forgets", r.type, "image/jpeg");
  is("and its size", r.size, 4096);
  is("and its bytes", r.sample, [0, 1, 250, 0]);
  is("both captures are queued", r.pending, { ticks: 0, proof: 2, total: 2 });
}

// The refusal must not have shut the queue. Ticks are plain objects and the
// store takes them fine; that was the whole clue on the first live night.
{
  const r = await p.evaluate(async () => {
    const ok = await outbox.enqueue({ kind: "tick", key: "t1", slug: "s", itemId: "i", initials: "RB", on: true, clientAt: new Date().toISOString() });
    return { ok, canQueue: outbox.canQueue() };
  });
  is("a tick still queues on that phone", r.ok, true);
  is("and the queue is not marked shut", r.canQueue, true);
}

// The drain uploads the reconstructed Blob, not the buffer.
{
  const r = await p.evaluate(async () => {
    const sent = [];
    const { sent: n, lost, left } = await outbox.flush(async (op, blob) => {
      sent.push({ key: op.key, isBlob: blob instanceof Blob, type: blob?.type ?? null, size: blob?.size ?? null });
      return { error: null };
    });
    return { n, lost: lost.length, left, sent };
  });
  is("everything drains", r.n, 3);
  is("nothing is reported lost", r.lost, 0);
  is("the queue is empty after", r.left, { ticks: 0, proof: 0, total: 0 });
  is("the upload got a Blob for the one that fell back",
    r.sent.find((s) => s.key === "b"), { key: "b", isBlob: true, type: "image/jpeg", size: 4096 });
}

// A row whose bytes are neither shape is a row with no bytes, and the drain
// must say so rather than upload a string.
{
  const r = await p.evaluate(async () => {
    await outbox.enqueue({ kind: "tick", key: "t2", slug: "s", itemId: "i", initials: "RB", on: true, clientAt: new Date().toISOString() });
    const back = await outbox.blobFor("never-stored");
    return back === undefined;
  });
  is("missing bytes read as missing", r, true);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
