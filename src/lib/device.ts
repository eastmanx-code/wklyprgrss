/**
 * A stable, meaningless id for this phone.
 *
 * Only ever compared with itself. The countersign is typed rather than proven,
 * so the one thing the app can still observe is whether the person checking
 * the work is holding the same phone as the person who did it, and how long
 * they took. Two signatures off one device forty seconds apart is the shape of
 * somebody signing their own work twice.
 *
 * Random and stored locally, so it says nothing about the phone, the person or
 * where they are. It is not an identity and cannot be turned into one. A
 * cleared browser gets a new one, which weakens the signal and is the right
 * trade against keeping anything real.
 */
const KEY = "ww-device";

export function deviceId(): string {
  try {
    const held = window.localStorage.getItem(KEY);
    if (held) return held;
    const made =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, made);
    return made;
  } catch {
    // Storage blocked. No id rather than a new one every time, which would
    // read as two different phones and quietly clear a real signal.
    return "";
  }
}
