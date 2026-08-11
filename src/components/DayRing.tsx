import { useMemo } from "react";
import { PRAYER_LABELS, type Prayer } from "../lib/types";
import { windowShares, type PrayerWindow, type WindowPosition } from "../lib/windows";
import { formatTime } from "../lib/time";

/**
 * The day ring — design spec v2 §9.
 *
 * Not a progress donut. The full circle is one day, divided into five arcs,
 * one per prayer window, each in its own colour and *proportional to that
 * window's real duration*. The shape therefore changes across the year: in
 * Toronto's June, Isha's arc is visibly short. That is the design carrying
 * true information rather than decorating it.
 *
 * Inline SVG, one circle per arc via stroke-dasharray, rotated so the day
 * starts at twelve o'clock — no canvas, no charting library (§9).
 */
const SIZE = 320;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Visual breathing room between arcs, in user units of the circumference. */
const GAP = 4;

export default function DayRing({
  windows,
  position,
  /** Ticking countdown, pre-formatted — the ring doesn't own a clock. */
  countdown,
  /** Which window the numbers describe; usually the current one. */
  focus,
  adhan,
  onSelectPrayer,
  children,
}: {
  windows: PrayerWindow[];
  position: WindowPosition;
  countdown: string;
  focus: Prayer;
  adhan: Date | null;
  onSelectPrayer?: (prayer: Prayer) => void;
  /** The reachable-congregation line beneath the numbers. */
  children?: React.ReactNode;
}) {
  const arcs = useMemo(() => {
    const shares = windowShares(windows);
    let offset = 0;

    return windows.map((window, i) => {
      const length = shares[i] * CIRCUMFERENCE;
      const arc = {
        prayer: window.prayer,
        // Leave the gap out of the drawn length rather than out of the
        // spacing, so the arcs still sum to exactly one circle.
        dash: Math.max(0, length - GAP),
        offset,
        state:
          i < position.index
            ? ("past" as const)
            : i === position.index
              ? ("current" as const)
              : ("future" as const),
      };
      offset += length;
      return arc;
    });
  }, [windows, position.index]);

  // Where "now" sits on the circle, as an angle from twelve o'clock.
  const markerAngle = position.dayProgress * 360 - 90;
  const markerX = SIZE / 2 + RADIUS * Math.cos((markerAngle * Math.PI) / 180);
  const markerY = SIZE / 2 + RADIUS * Math.sin((markerAngle * Math.PI) / 180);

  return (
    // Two boxes: the ring keeps the diameter §9 specifies, and the corner
    // times pin to a wider box around it. Insetting the ring itself to make
    // room would shrink it below the size the countdown is sized against.
    // A container query, not rem, sizes everything inside the ring. The ring
    // is a fixed-geometry diagram in a pixel-bounded box: if its labels scale
    // with the root font while the circle does not, a 200% text setting pushes
    // the corner times off-screen (§12 forbids horizontal scroll there).
    // Everything here therefore scales with the container, which stays inside
    // the viewport whatever the font size.
    <div
      className="relative mx-auto w-full"
      style={{ maxWidth: 420, containerType: "inline-size" }}
    >
      <div
        className="relative mx-auto"
        style={{ width: "min(66cqw, 300px)" }}
      >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full"
        role="img"
        aria-hidden="true"
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.prayer}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={`var(--${arc.prayer})`}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={-arc.offset}
              // Elapsed dims to 25%, upcoming sit at 55%, current is full (§9).
              opacity={
                arc.state === "past" ? 0.25 : arc.state === "current" ? 1 : 0.55
              }
            />
          ))}
        </g>

        {position.index >= 0 && (
          <>
            <circle
              cx={markerX}
              cy={markerY}
              r={10}
              fill="var(--now)"
              opacity={0.25}
            />
            <circle cx={markerX} cy={markerY} r={5} fill="var(--now)" />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
        <span
          className="font-num font-medium tabular-nums text-ink"
          style={{ fontSize: "min(var(--t-5), 17cqw)", lineHeight: 1.05 }}
        >
          {countdown}
        </span>
        <span
          className="mt-1 text-ink-2"
          style={{ fontSize: "min(var(--t-0), 4cqw)" }}
        >
          until
        </span>
        <span
          className="font-display font-semibold"
          style={{ fontSize: "min(var(--t-3), 7cqw)", color: "var(--now)" }}
        >
          {PRAYER_LABELS[focus]}
        </span>
        {adhan && (
          <span
            className="font-num text-ink-2"
            style={{ fontSize: "min(var(--t-1), 4.5cqw)" }}
          >
            {formatTime(adhan)}
          </span>
        )}
        {children}
      </div>

      </div>

      {onSelectPrayer && (
        <CornerTimes windows={windows} focus={focus} onSelect={onSelectPrayer} />
      )}
    </div>
  );
}

/**
 * The other prayers' times at the ring's four corners (§9), tappable to
 * select that prayer. The focused one is omitted — its time is already the
 * large number in the middle.
 */
function CornerTimes({
  windows,
  focus,
  onSelect,
}: {
  windows: PrayerWindow[];
  focus: Prayer;
  onSelect: (prayer: Prayer) => void;
}) {
  // Clockwise from the top-left, following the ring's own order so a glance
  // reads them in the sequence the day runs.
  const corners: Record<Prayer, string> = {
    fajr: "left-0 top-0 items-start text-left",
    dhuhr: "right-0 top-0 items-end text-right",
    asr: "left-0 top-1/2 -translate-y-1/2 items-start text-left",
    maghrib: "left-0 bottom-0 items-start text-left",
    isha: "right-0 bottom-0 items-end text-right",
  };

  return (
    <>
      {windows
        .filter((w) => w.prayer !== focus)
        .map((w) => (
          <button
            key={w.prayer}
            type="button"
            onClick={() => onSelect(w.prayer)}
            className={`absolute flex min-h-[44px] flex-col justify-center ${corners[w.prayer]}`}
            style={{ width: "16cqw", fontSize: "min(var(--t--1), 3.4cqw)" }}
          >
            <span className="uppercase tracking-[0.08em] text-ink-3">
              {PRAYER_LABELS[w.prayer]}
            </span>
            <span className="font-num text-ink-2">{formatTime(w.start)}</span>
          </button>
        ))}
    </>
  );
}
