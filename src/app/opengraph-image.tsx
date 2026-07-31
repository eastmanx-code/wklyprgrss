import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${APP_NAME} — weekly progress photos for venue leaders`;

/**
 * The card that shows when the link is pasted into a message.
 *
 * Geist Mono is vendored beside this file rather than pulled from the font
 * CDN: Satori needs real font data, next/font's cached files are hashed
 * build artifacts, and a fetch here would make the build depend on a network
 * round trip. The OFL licence sits next to it, which that licence requires.
 */
export default async function OpengraphImage() {
  const mono = await readFile(
    join(process.cwd(), "src/app/_assets/GeistMono-Regular.ttf"),
  );

  // Six spokes, drawn as three lines through the centre — same mark as the
  // favicon, at a size where the strokes can be finer.
  const spokes = [0, 60, 120].map((deg) => {
    const a = ((90 + deg) * Math.PI) / 180;
    const dx = Math.cos(a) * 74;
    const dy = -Math.sin(a) * 74;
    return { dx, dy };
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0a",
          color: "#f1f1ef",
          padding: 72,
          fontFamily: "Geist Mono",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 180 180">
          {spokes.map((s, i) => (
            <line
              key={i}
              x1={90 - s.dx}
              y1={90 - s.dy}
              x2={90 + s.dx}
              y2={90 + s.dy}
              stroke="#f1f1ef"
              strokeWidth="26"
            />
          ))}
        </svg>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, letterSpacing: "0.02em" }}>
            {APP_NAME}
          </div>
          <div
            style={{
              fontSize: 30,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.45)",
              marginTop: 20,
            }}
          >
            WEEKLY WALKTHROUGH PHOTOS · CH PROJECTS
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Geist Mono", data: mono, style: "normal", weight: 400 }],
    },
  );
}
