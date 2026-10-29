"use client";

import { useEffect, useState } from "react";

/**
 * A link opened from inside Gmail, Slack, WhatsApp, Instagram and the like runs
 * in a stripped-down in-app browser, not the phone's real browser. That shell
 * breaks the close and the walkthrough: a box taps but will not stay checked,
 * the keyboard for initials does not come up, writes do not flush, and the
 * camera and photo upload are blocked outright, so a walkthrough photo will not
 * add however it is taken. A refresh keeps landing in the same broken browser so
 * nothing improves. A BORN closer lost about thirteen minutes to exactly this,
 * and a HOOD manager could not add a single walkthrough photo from her mail
 * app's browser.
 *
 * So when we recognise one of those shells, we say so plainly and push the
 * person to their own browser before they start a list. Everything is ALL CAPS,
 * like the rest of the app.
 */

/**
 * The shells that name themselves. Social apps, plus the mail and chat apps a
 * manager actually taps a link from — the Google app (GSA), Slack and Outlook —
 * each of which opens its own in-app browser.
 */
const IN_APP =
  /(WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Pinterest|GSA\/|Slack|Outlook)/i;

/**
 * The iOS shells that do not name themselves.
 *
 * An app-embedded web view on iOS, Gmail's among them, is WebKit with a
 * `Mobile/` build but, unlike every real browser, carries no browser token:
 * Safari, Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), Opera, Brave and
 * DuckDuckGo all name themselves, and a home-screen install runs standalone. So
 * an iOS WebKit page that is `Mobile`, names no browser and is not standalone is
 * an in-app web view — the camera-blocking shell the list above misses whenever
 * the host app is one nobody thought to name. Scoped this tight so it can never
 * flag a real browser or a pinned app.
 */
function isIosInAppWebView(ua: string): boolean {
  if (!/iPhone|iPad|iPod/i.test(ua)) return false;
  if (!/AppleWebKit/i.test(ua) || !/Mobile\//i.test(ua)) return false;
  if (/Safari|CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|Brave|DuckDuckGo/i.test(ua)) {
    return false;
  }
  // A home-screen install is exactly where we want photos to work, not a shell
  // to warn about.
  const standalone =
    typeof navigator !== "undefined" &&
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function InAppBrowserNotice() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Mount-only, client-only check: the user agent is not there on the server,
    // so the banner can only ever be decided here, after hydration.
    try {
      const ua = navigator.userAgent || "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time UA detection, not derivable before mount
      if (IN_APP.test(ua) || isIosInAppWebView(ua)) setShow(true);
    } catch {
      // No userAgent to read, so nothing to warn about.
    }
  }, []);

  if (!show) return null;

  function copy() {
    try {
      void navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function openInBrowser() {
    try {
      const ua = navigator.userAgent || "";
      if (/Android/i.test(ua)) {
        // An intent URL hands the link to Android's default browser.
        const here = new URL(window.location.href);
        window.location.href = `intent://${here.host}${here.pathname}${here.search}#Intent;scheme=https;end`;
        return;
      }
    } catch {
      // Fall through to copying the link.
    }
    // iOS in-app browsers give no way to force the jump, so copy the link and
    // leave the one manual step on screen.
    copy();
  }

  return (
    <div
      role="alert"
      className="border-warn/50 bg-warn/15 text-warn sticky top-0 z-50 border-b px-4 py-3"
    >
      <div className="mx-auto max-w-3xl lg:max-w-6xl">
        <p className="text-title tracking-[0.08em]">OPEN THIS IN YOUR BROWSER</p>
        <p className="note mt-1 leading-relaxed">
          YOU ARE IN AN IN-APP BROWSER (GMAIL, SLACK, INSTAGRAM AND THE LIKE).
          PHOTOS WILL NOT ADD AND THE CHECKLIST CAN STICK OR REFUSE TO SIGN
          HERE. OPEN IT IN YOUR BROWSER AND THIS STOPS.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={openInBrowser}>
            OPEN IN BROWSER
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={copy}>
            {copied ? "LINK COPIED" : "COPY LINK"}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShow(false)}
          >
            DISMISS
          </button>
        </div>
        <p className="note text-muted mt-2 leading-relaxed">
          IPHONE: TAP THE ••• OR COMPASS ICON, THEN TAP OPEN IN BROWSER. OR ADD
          TO HOME SCREEN AND OPEN IT FROM THERE.
        </p>
      </div>
    </div>
  );
}
