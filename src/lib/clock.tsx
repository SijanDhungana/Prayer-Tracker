/**
 * The app's one clock — design spec v2 §10.4.
 *
 * "One clock hook ticking at 1s with derived per-minute and per-window memos,
 * not four independent timers." Four timers is how the ring, the prayer
 * selector's default, the tab bar's accent and Jumu'ah's banner end up
 * disagreeing about what time it is at a window boundary.
 *
 * Three values come out of it, each changing at its own rate, so a component
 * that only cares about minutes doesn't re-render sixty times a minute:
 *
 *   second  — the ticking countdown, and nothing else
 *   minute  — every list row's "in 2 h 14 min", the accessible twin
 *   window  — the prayer accent, which changes five times a day
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { masjids as allMasjids } from "../data/masjids";
import { todayIn } from "./time";
import { currentWindow, type PrayerWindow, type WindowPosition } from "./windows";
import type { Prayer } from "./types";

interface ClockState {
  /** Ticks every second. Only the countdown should depend on this. */
  second: Date;
  /** Ticks on minute boundaries. */
  minute: Date;
  /** The calendar day, Toronto time. */
  today: Date;
  /** The five windows of the circle `second` currently sits in. */
  windows: PrayerWindow[];
  position: WindowPosition;
  /** The prayer window we're inside, or null before the first Fajr of data. */
  window: Prayer | null;
}

const ClockContext = createContext<ClockState | null>(null);

export function ClockProvider({ children }: { children: ReactNode }) {
  const [second, setSecond] = useState(() => new Date());
  const [minute, setMinute] = useState(() => new Date());

  useEffect(() => {
    // Aligned to the wall clock rather than to mount time, so the displayed
    // second flips when the real second does.
    let timer: number;
    const tick = () => {
      const now = new Date();
      setSecond(now);
      setMinute((prev) =>
        Math.floor(prev.getTime() / 60_000) === Math.floor(now.getTime() / 60_000)
          ? prev
          : now,
      );
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);

  // Recomputed only when the minute changes: the window a second belongs to
  // cannot change mid-minute in any way that matters.
  const today = useMemo(() => todayIn(), [minute]);

  const { windows, position } = useMemo(() => {
    const reference = allMasjids[0];
    if (!reference) {
      return {
        windows: [] as PrayerWindow[],
        position: { index: -1, window: null, progress: 0, dayProgress: 0 },
      };
    }
    return currentWindow(reference, today, minute);
  }, [today, minute]);

  const window_ = position.window?.prayer ?? null;

  useAccent(window_);

  const value = useMemo<ClockState>(
    () => ({ second, minute, today, windows, position, window: window_ }),
    [second, minute, today, windows, position, window_],
  );

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

/**
 * Point --now at the current prayer window, on <html>, so the whole app's
 * accent follows the sun (§4, §9).
 *
 * The transition class is added only when the window actually changes and
 * removed once it has run — §15: "Don't animate the prayer accent on every
 * render, only on a real window change."
 */
function useAccent(prayer: Prayer | null) {
  const previous = useRef<Prayer | null>(null);

  useEffect(() => {
    if (!prayer) return;
    const root = document.documentElement;

    root.style.setProperty("--now", `var(--${prayer})`);
    root.style.setProperty("--now-wash", `var(--${prayer}-wash)`);

    const changed = previous.current !== null && previous.current !== prayer;
    previous.current = prayer;
    if (!changed) return;

    root.classList.add("accent-changing");
    const id = window.setTimeout(
      () => root.classList.remove("accent-changing"),
      400, // --slow
    );
    return () => window.clearTimeout(id);
  }, [prayer]);
}

export function useClock(): ClockState {
  const ctx = useContext(ClockContext);
  if (!ctx) throw new Error("useClock must be used inside <ClockProvider>");
  return ctx;
}

/** Just the minute hand, for the many components that only need that. */
export function useMinute(): Date {
  return useClock().minute;
}
