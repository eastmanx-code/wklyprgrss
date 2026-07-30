"use client";

/**
 * Light/dark toggle, present on every screen.
 *
 * The button's label is chosen in CSS rather than React state, so the server
 * and client render identical markup and there's no flicker or hydration
 * mismatch. Clicking stamps `data-theme` on <html> and remembers the choice;
 * with no choice stored the page follows the device setting.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("ww_theme", next);
    } catch {
      // Storage unavailable — the choice just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost fixed right-4 bottom-4 z-50 shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      aria-label="Switch between light and dark"
    >
      <span className="theme-to-dark">Dark</span>
      <span className="theme-to-light">Light</span>
    </button>
  );
}

/**
 * Applies the saved theme before first paint. Inlined in <head> so there is no
 * flash of the wrong theme on load.
 */
export const themeScript = `
try {
  var t = localStorage.getItem('ww_theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
`;
