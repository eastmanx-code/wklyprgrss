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
      // No attribute means dark: it is the base theme, not a device-dependent
      // guess, so the first tap always goes to light.
      root.dataset.theme ?? "dark";
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
      className="ww-menu-theme btn-ghost aspect-square !px-0 shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      aria-label="Switch between light and dark"
      title="Switch between light and dark"
    >
      {/* A glyph rather than a word: the corner menu is three controls wide on
          a phone and the label was the longest thing in it. */}
      <svg
        className="theme-to-dark"
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden
      >
        {/* Crescent — tap for dark. */}
        <path d="M13.5 10.4A6 6 0 0 1 5.6 2.5a6 6 0 1 0 7.9 7.9Z" />
      </svg>
      <svg
        className="theme-to-light"
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden
      >
        {/* Sun — tap for light. */}
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1" />
      </svg>
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
