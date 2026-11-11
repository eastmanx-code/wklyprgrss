/**
 * The app, when the phone has nothing.
 *
 * A close gets walked in a cellar and a walk-in, which is exactly where there
 * are no bars. The queue already covers the taps: work done on a loaded page
 * survives and goes up later. What it never covered is the page not being
 * loaded — a phone that slept, a tab iOS evicted, somebody handing the phone
 * over — because a cold open with no signal is the browser's own error page
 * and there is nothing underneath it to fall back on.
 *
 * Deliberately small and deliberately timid. Every route in this app is
 * force-dynamic, so there is no shell to serve and nothing here pretends
 * otherwise: the network is always tried first and a copy is only ever handed
 * over after the network has actually failed.
 *
 * The one rule that makes that safe is age. A page cached earlier tonight is
 * the night you are working. A page cached last week is a different night's
 * list wearing tonight's clothes, and showing it would be worse than showing
 * nothing, so it is not shown. Ticks are safe either way — the queue holds a
 * list address and an item, never a night id, and the server works out which
 * night it belongs to when it arrives — but what is on the screen has to be
 * something somebody can trust.
 */

const VERSION = "ww-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

/**
 * How old a page may be and still be worth showing.
 *
 * A shift, near enough. Long enough that loading the list at ten and coming
 * back to it at two in the morning works, short enough that last night's list
 * never appears as tonight's.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const STAMP = "x-ww-cached-at";

/**
 * How long a page may take before the saved copy is shown instead.
 *
 * "No signal" was the only failure this file knew. On 2026-11-10 the server
 * stopped answering for four minutes with every phone still online: the
 * request went out, hung for half a minute and came back as a timeout page,
 * and none of that is a network failure, so the copy sitting right here was
 * never offered. Somebody trying to open their list at 11:36 at night got a
 * blank wait and then an error, with the list one cache lookup away.
 *
 * Six seconds is past every healthy page in the app and well short of the
 * point where a person decides it is broken.
 */
const NAV_TIMEOUT_MS = 6000;

/** The answers that mean "the server is not there", not "the app said no". */
const GATEWAY_DOWN = new Set([502, 503, 504]);

self.addEventListener("install", () => {
  // Nothing is pre-cached. There is no shell, and a list of asset URLs written
  // here would be wrong the next time anything is built.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !name.startsWith(VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Forget every cached page.
 *
 * Sent on the way out of a session. Two people share a phone behind a bar and
 * the second one must not be able to pull the first one's venue back out of
 * this cache by going offline.
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "forget") {
    event.waitUntil(caches.delete(PAGES));
  }
});

/** A copy with the time it was taken written on it. */
function stamped(response) {
  const headers = new Headers(response.headers);
  headers.set(STAMP, String(Date.now()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function tooOld(response) {
  const at = Number(response.headers.get(STAMP));
  return !at || Date.now() - at > MAX_AGE_MS;
}

const OFFLINE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>No signal</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
         background:#0b0b0a; color:#eae7e1; padding:2rem;
         font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;
         text-transform:uppercase; letter-spacing:.06em; text-align:center }
  p { max-width:26rem; margin:0 0 1rem }
  .quiet { color:#8b8781 }
  button { font:inherit; text-transform:inherit; letter-spacing:inherit;
           background:none; color:inherit; border:1px solid #3a3833;
           border-radius:3px; padding:.85rem 1.6rem; min-height:44px }
</style></head>
<body><div>
  <p>No signal, and this page was not open.</p>
  <p class="quiet">Sin se&#241;al, y esta p&#225;gina no estaba abierta.</p>
  <p class="quiet">Anything you already ticked is saved on this phone and goes
     up on its own. Find signal and try again.</p>
  <p class="quiet">Lo que ya marcaste est&#225; guardado en este tel&#233;fono y
     se env&#237;a solo. Busca se&#241;al e int&#233;ntalo otra vez.</p>
  <button onclick="location.reload()">Try again &#183; Reintentar</button>
</div></body></html>`;

const offlinePage = () =>
  new Response(OFFLINE, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

// The same page with the other cause on it. The phone has signal; the server
// is the part that is missing, and saying "no signal" to somebody standing
// next to the router sends them to fix the wrong thing.
const BUSY = OFFLINE.replace("<title>No signal</title>", "<title>Not answering</title>")
  .replace(
    "<p>No signal, and this page was not open.</p>",
    "<p>The app is not answering right now, and this page was not open.</p>",
  )
  .replace(
    "Sin se&#241;al, y esta p&#225;gina no estaba abierta.",
    "La app no responde ahora mismo, y esta p&#225;gina no estaba abierta.",
  )
  .replace("Find signal and try again.", "Give it a minute and try again.")
  .replace(
    "Busca se&#241;al e int&#233;ntalo otra vez.",
    "Espera un minuto e int&#233;ntalo otra vez.",
  );

const busyPage = () =>
  new Response(BUSY, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Built assets carry a hash in the name, so a hit is the same bytes for
  // ever and a miss is a new build. The one place cache-first is safe.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(STATIC).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Only whole pages. A navigation is a person arriving somewhere; the data
  // fetches behind one carry the same URL with a marker on it and answering
  // those from a cache is how a screen ends up half tonight and half last
  // week. Server actions are POSTs and never reach here at all.
  if (request.mode !== "navigate" || url.search) return;

  event.respondWith(
    (async () => {
      // The copy from earlier tonight, or nothing. Never one old enough to be
      // a different night's work.
      const saved = async () => {
        const hit = await caches.match(request, { cacheName: PAGES });
        return hit && !tooOld(hit) ? hit : null;
      };

      // The live answer. Left running even after this stops waiting for it,
      // so a reply that arrives late still replaces the saved copy.
      const live = fetch(request).then((response) => {
        if (response.ok) {
          const copy = stamped(response.clone());
          void caches.open(PAGES).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      event.waitUntil(live.catch(() => undefined));

      let timer;
      const slow = new Promise((resolve) => {
        timer = setTimeout(() => resolve("slow"), NAV_TIMEOUT_MS);
      });

      let first;
      try {
        first = await Promise.race([live, slow]);
      } catch {
        first = "down";
      } finally {
        clearTimeout(timer);
      }

      // No connection at all. What this file was written for.
      if (first === "down") return (await saved()) ?? offlinePage();

      // Still waiting. Show the copy if there is one; with nothing to show,
      // keep waiting, because a slow page beats no page.
      if (first === "slow") {
        const hit = await saved();
        if (hit) return hit;
        try {
          const late = await live;
          return GATEWAY_DOWN.has(late.status) ? busyPage() : late;
        } catch {
          return offlinePage();
        }
      }

      // Answered, but with the hosting saying the server is not there.
      if (GATEWAY_DOWN.has(first.status)) return (await saved()) ?? busyPage();

      // A real answer, including a real error the app chose to give.
      return first;
    })(),
  );
});
