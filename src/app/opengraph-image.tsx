import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { APP_NAME } from "@/lib/app";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${APP_NAME} — defining the standards`;

const ASSETS = join(process.cwd(), "src/app/_assets");
const TAGLINE = "DEFINING THE STANDARDS";

/** Six spokes as three lines through the centre — same mark as the favicon. */
function Asterisk({ size: s, stroke }: { size: number; stroke: number }) {
  const c = s / 2;
  const r = c - stroke;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {[0, 60, 120].map((deg, i) => {
        const a = ((90 + deg) * Math.PI) / 180;
        const dx = Math.cos(a) * r;
        const dy = -Math.sin(a) * r;
        return (
          <line
            key={i}
            x1={c - dx}
            y1={c - dy}
            x2={c + dx}
            y2={c + dy}
            stroke="#f1f1ef"
            strokeWidth={stroke}
          />
        );
      })}
    </svg>
  );
}

/**
 * The card shown when the link is pasted into a message.
 *
 * Uses the photograph at _assets/og-photo.* when one is present, and falls
 * back to the mark on black when it isn't — a missing asset should degrade,
 * not fail the build, since this file runs during it.
 *
 * Geist Mono is vendored beside this file: Satori needs real font data,
 * next/font's cached copies are hashed build artifacts with unstable names,
 * and fetching at render time would make the build depend on a network round
 * trip.
 */
async function loadPhoto(): Promise<string | null> {
  for (const name of ["og-photo.jpg", "og-photo.jpeg", "og-photo.png"]) {
    try {
      const bytes = await readFile(join(ASSETS, name));
      const mime = name.endsWith(".png") ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${bytes.toString("base64")}`;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

export default async function OpengraphImage() {
  const mono = await readFile(join(ASSETS, "GeistMono-Regular.ttf"));
  const photo = await loadPhoto();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#0b0b0a",
        fontFamily: "Geist Mono",
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          width={size.width}
          height={size.height}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}

      {/* Scrim: the tagline has to hold over whatever the photo does at the
            bottom edge. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(to bottom, rgba(11,11,10,0.15) 0%, rgba(11,11,10,0.55) 55%, rgba(11,11,10,0.92) 100%)",
        }}
      />

      {/* Explicit width/height, not just inset: Satori won't resolve
            space-between against an auto height. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
        }}
      >
        <Asterisk size={photo ? 84 : 120} stroke={photo ? 13 : 18} />

        {/* Two lines rather than one: the full string is 37 characters, and
              at a size that fills the card it runs off the right edge. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 64,
              letterSpacing: "0.04em",
              color: "#f1f1ef",
              lineHeight: 1.2,
            }}
          >
            {APP_NAME}
          </div>
          <div
            style={{
              fontSize: 30,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.75)",
              marginTop: 16,
            }}
          >
            {TAGLINE}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Geist Mono", data: mono, style: "normal", weight: 400 }],
    },
  );
}
