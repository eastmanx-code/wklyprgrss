"use client";

import { useEffect, useState } from "react";

import { DashRow } from "./DashRow";

/**
 * The rows that only mean anything live: how long is left, what time it is
 * where the venues are, and what it's doing outside.
 *
 * Each renders an em dash until mounted so the server and client markup agree.
 * None of them decide anything — pass and fail are still computed from server
 * time.
 */

export function CountdownRow({ deadlineMs }: { deadlineMs: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  if (remaining === null) {
    return <DashRow label="Time left" value="—" emphasis />;
  }

  if (remaining <= 0) {
    return (
      <DashRow
        label="Time left"
        value="Past due"
        fill={1}
        tone="bg-fail"
        emphasis
      />
    );
  }

  const minutes = Math.floor(remaining / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  // The bar drains across the week, so it reads as time running out.
  const week = 7 * 24 * 60 * 60 * 1000;
  const urgent = remaining < 24 * 60 * 60 * 1000;

  return (
    <DashRow
      label="Time left"
      fill={remaining / week}
      tone={urgent ? "bg-fail" : "bg-ink"}
      emphasis
      value={
        days > 0 ? (
          <>
            {days}
            <span className="text-base">d </span>
            {hours}
            <span className="text-base">h</span>
          </>
        ) : (
          <>
            {hours}
            <span className="text-base">h </span>
            {mins}
            <span className="text-base">m</span>
          </>
        )
      }
    />
  );
}

export function ClockRow() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <DashRow label="Now" value="—" />;

  // Always Pacific: the deadline is Pacific, so a leader travelling east
  // should still see the clock the deadline is measured against.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <DashRow
      label="Now"
      value={
        <>
          {parts}
          <span className="text-base"> PT</span>
        </>
      }
    />
  );
}

/** WMO codes, collapsed to the handful of words worth showing. */
function describe(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow";
  return "Storm";
}

/**
 * Los Angeles weather, for the walkthroughs that happen on patios.
 *
 * Open-Meteo needs no key and receives nothing but a fixed coordinate — no
 * venue or person is identified. If it fails the row shows a dash rather than
 * an error: it is decoration, and nothing depends on it.
 */
export function WeatherRow() {
  const [weather, setWeather] = useState<{
    temp: number;
    code: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=34.05&longitude=-118.24" +
        "&current=temperature_2m,weather_code&temperature_unit=fahrenheit",
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.current) return;
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!weather) return <DashRow label="Los Angeles" value="—" />;

  return (
    <DashRow
      label={`Los Angeles · ${describe(weather.code)}`}
      value={
        <>
          {weather.temp}
          <span className="text-base">°F</span>
        </>
      }
    />
  );
}
