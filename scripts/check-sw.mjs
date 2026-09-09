/**
 * Checks for the offline fallback, against a real browser.
 *
 *   npm i --no-save playwright-core
 *   node scripts/check-sw.mjs
 *
 * Run by hand, not in CI. Everything else in this project is checked against
 * fixtures that need nothing but node, and adding a browser to the pipeline
 * for one file is not a trade worth making — but a service worker cannot be
 * proved any other way. It sits between every request and the network, and a
 * broken one is not a broken feature, it is a broken site.
 *
 * The network is cut by destroying the socket rather than with Playwright's
 * offline switch, which does not reach a service worker's own fetches. The
 * first version of this passed while the worker was quietly still online,
 * which is the exact failure it exists to catch.
 */
import http from "node:http";
import fs from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.log("\n  needs a browser driver:  npm i --no-save playwright-core\n");
  process.exit(1);
}

const CHROME =
  process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SW = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
let hits = 0;
let down = false;

const server = http.createServer((req, res) => {
  if (down) return req.socket.destroy();
  if (req.url === "/sw.js") {
    res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-cache" });
    return res.end(SW);
  }
  // Only the pages under test. The browser also asks for a favicon, and
  // counting that made the numbers below drift.
  if (req.url.startsWith("/checklists/")) hits += 1;
  res.writeHead(200, { "content-type": "text/html" });
  res.end(`<!doctype html><html><head><title>list ${hits}</title></head><body><h1 id=n>page ${hits}</h1></body></html>`);
});
await new Promise((r) => server.listen(3999, r));

let pass = 0, fail = 0;
const is = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
};

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext();
const p = await ctx.newPage();
const LIST = "http://localhost:3999/checklists/foh-host-close";

await p.goto(LIST);
await p.evaluate(() => navigator.serviceWorker.register("/sw.js"));
await p.evaluate(() => navigator.serviceWorker.ready);
await p.reload();
is("controlled after reload", await p.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
const online = await p.title();

// The whole point: the phone slept, the tab went, and there is no signal.
down = true;
await p.reload();
is("a cold open with no signal serves the copy", await p.title(), online);
is("and does not reach the network", hits, 2);

// A page never opened has nothing to fall back on and must say so.
await p.goto("http://localhost:3999/checklists/foh-prep-open").catch(() => {});
is("an unvisited page says so", await p.title(), "No signal");
is("in both languages", (await p.textContent("body")).includes("Sin señal"), true);

// A copy from a different night must never be served as tonight's list.
down = false;
await p.goto(LIST);
await p.evaluate(async () => {
  const name = (await caches.keys()).find((k) => k.endsWith("-pages"));
  const cache = await caches.open(name);
  for (const key of await cache.keys()) {
    const held = await cache.match(key);
    const headers = new Headers(held.headers);
    headers.set("x-ww-cached-at", String(Date.now() - 7 * 60 * 60 * 1000));
    await cache.put(key, new Response(await held.text(), { headers }));
  }
});
down = true;
await p.reload();
is("a copy older than a shift is refused", await p.title(), "No signal");

// Signing out drops the lot, so the next person on the phone cannot pull the
// last one's venue back out of it.
down = false;
await p.goto(LIST);
await p.evaluate(() => navigator.serviceWorker.controller.postMessage({ type: "forget" }));
await new Promise((r) => setTimeout(r, 300));
down = true;
await p.reload();
is("signing out clears the cached pages", await p.title(), "No signal");

// Data fetches must go to the network, or a screen ends up half tonight and
// half last week.
down = false;
await p.goto(LIST);
const before = hits;
await p.evaluate(() => fetch(location.pathname + "?_rsc=abc").then((r) => r.text()));
is("a data fetch is not answered from the cache", hits, before + 1);

console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
