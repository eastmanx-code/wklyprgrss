"use client";

import { useEffect, useState } from "react";

/**
 * The bits that only mean anything live. Each is a bare inline value with no
 * chrome of its own, so the page using them decides how they look.
 *
 * All render an em dash until mounted so server and client markup agree. None
 * of them decide anything — pass and fail are computed from server time.
 */

export function Countdown({ deadlineMs }: { deadlineMs: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(deadlineMs - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  if (remaining === null) return <>—</>;
  if (remaining <= 0) return <span className="text-fail">Past due</span>;

  const minutes = Math.floor(remaining / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  return (
    <>
      {days > 0 ? (
        <>
          {days}
          <span className="text-xl">d </span>
          {hours}
          <span className="text-xl">h</span>
        </>
      ) : (
        <>
          {hours}
          <span className="text-xl">h </span>
          {mins}
          <span className="text-xl">m</span>
        </>
      )}
    </>
  );
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <>—</>;

  // Always Pacific: the deadline is Pacific, so a leader travelling east still
  // sees the clock the deadline is measured against.
  return (
    <>
      {new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(now)}{" "}
      PT
    </>
  );
}

/** WMO codes, collapsed to the handful of words worth showing. */
function describe(code: number): string {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code <= 86) return "snow";
  return "storm";
}

/**
 * San Diego weather, for the walkthroughs that happen on patios.
 *
 * Open-Meteo needs no key and receives nothing but a fixed coordinate — no
 * venue or person is identified. If it fails it renders nothing at all: it is
 * decoration, and nothing depends on it.
 */
export function Weather() {
  const [weather, setWeather] = useState<{
    temp: number;
    code: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=32.7157&longitude=-117.1611" +
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

  if (!weather) return null;

  return (
    <>
      San Diego {weather.temp}° {describe(weather.code)}
    </>
  );
}
