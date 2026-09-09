/**
 * Fixture checks for the record of why a capture failed.
 *
 *   npm run check-trouble
 *
 * The whole point of this file is the case nobody can reproduce: a phone with
 * no signal, in a cellar, at one in the morning. Every one of these is a way
 * that record could quietly go missing, which would leave the next
 * investigation exactly where the last one was — reading a text message and
 * guessing.
 *
 * localStorage is faked rather than mocked out, because the interesting
 * failures are storage failures.
 */
import { flushTrouble, noteTrouble, words } from "../.trouble-check/trouble.js";

let pass = 0, fail = 0;
const is = (label, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; } else { fail++; console.log(`  FAIL ${label}\n    got  ${a}\n    want ${b}`); }
};

/** A localStorage that behaves, and can be told to stop behaving. */
function fakeStorage() {
  const held = new Map();
  const store = {
    broken: false,
    getItem(key) {
      if (store.broken) throw new Error("SecurityError");
      return held.has(key) ? held.get(key) : null;
    },
    setItem(key, value) {
      if (store.broken) throw new Error("QuotaExceededError");
      held.set(key, value);
    },
    removeItem(key) { held.delete(key); },
    raw: () => held.get("ww-trouble"),
    put: (value) => held.set("ww-trouble", value),
  };
  return store;
}

const install = () => {
  const store = fakeStorage();
  globalThis.localStorage = store;
  // Node defines navigator as a getter, so it is replaced rather than assigned.
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "iPhone" },
    configurable: true,
  });
  return store;
};

const rows = () => JSON.parse(globalThis.localStorage.raw() ?? "[]");
const never = () => Promise.reject(new Error("no signal"));
const sink = () => { const got = []; return { got, send: async (r) => { got.push(...r); } }; };

// --------------------------------------------------------------- the words

is("an error's message", words(new Error("boom")), "boom");
is("a named error keeps its name", words(new DOMException("nope", "QuotaExceededError")), "QuotaExceededError: nope");
is("a string is itself", words("plain"), "plain");
is("something that is not an error at all", words({ a: 1 }), '{"a":1}');
// The one that used to put a hole where the reason should be.
is("nothing at all still reads as something", words(undefined), "undefined");
is("a circular object does not throw", words((() => { const a = {}; a.self = a; return a; })()), "[object Object]");

// ------------------------------------------------------ noting and sending

{
  install();
  const out = sink();
  noteTrouble({ step: "store", detail: "queue full", bytes: 12 }, out.send);
  await new Promise((r) => setTimeout(r, 0));
  is("it sent", out.got.map((r) => [r.step, r.detail, r.bytes]), [["store", "queue full", 12]]);
  is("the device is named", out.got[0].userAgent, "iPhone");
  is("the clock is stamped", typeof out.got[0].clientAt, "string");
  is("recovered defaults to false", out.got[0].recovered, false);
  is("nothing is left waiting", rows(), []);
}

// A refusal noted with no signal has to survive until there is some. This is
// the case the table exists for and the one every naive version loses.
{
  install();
  noteTrouble({ step: "vanished" }, never);
  await new Promise((r) => setTimeout(r, 0));
  is("it waits", rows().map((r) => r.step), ["vanished"]);

  noteTrouble({ step: "send", detail: "storage 403" }, never);
  await new Promise((r) => setTimeout(r, 0));
  is("and they stack", rows().map((r) => r.step), ["vanished", "send"]);

  const out = sink();
  await flushTrouble(out.send);
  is("signal comes back and both go", out.got.map((r) => r.step), ["vanished", "send"]);
  is("and the queue is empty", rows(), []);
}

// Only what was actually sent gets forgotten. A refusal noted while the send
// was in flight would otherwise be dropped without ever going anywhere.
{
  install();
  noteTrouble({ step: "read" }, never);
  await new Promise((r) => setTimeout(r, 0));
  const out = sink();
  await flushTrouble(async (r) => {
    out.got.push(...r);
    // Something goes wrong during the send.
    noteTrouble({ step: "record" }, never);
  });
  is("the one in flight went", out.got.map((r) => r.step), ["read"]);
  is("the one that arrived mid send is kept", rows().map((r) => r.step), ["record"]);
}

// A phone that has been failing all night has already told us what we needed.
{
  install();
  for (let i = 0; i < 50; i++) noteTrouble({ step: "send", detail: `n${i}` }, never);
  await new Promise((r) => setTimeout(r, 0));
  is("capped", rows().length, 40);
  is("and it is the newest that are kept", rows()[39].detail, "n49");
}

// Storage that will not answer is not a reason to interrupt a shift.
{
  const store = install();
  store.broken = true;
  let threw = false;
  try {
    noteTrouble({ step: "store" }, never);
    await flushTrouble(never);
  } catch { threw = true; }
  is("a dead localStorage throws nothing", threw, false);
}

// Somebody else's value under our key, or half a write. Reading it must not
// take down the capture that is being handled.
{
  const store = install();
  store.put("not json at all");
  const out = sink();
  noteTrouble({ step: "read" }, out.send);
  await new Promise((r) => setTimeout(r, 0));
  is("rubbish is replaced, not parsed", out.got.map((r) => r.step), ["read"]);

  store.put('{"a":1}');
  const two = sink();
  await flushTrouble(two.send);
  is("an object where a list belongs sends nothing", two.got, []);
}

// Nothing waiting means nothing sent. The drain calls this on every write
// that lands, and an empty flush must not be a request.
{
  install();
  let calls = 0;
  await flushTrouble(async () => { calls++; });
  is("an empty queue is not a request", calls, 0);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
