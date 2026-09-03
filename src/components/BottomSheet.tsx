import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * The map's results sheet — design spec v2 §8.1, §11.
 *
 * Three snap points, dragged with a pointer and flicked with velocity. The
 * sheet is the *only* non-map path to the same data (§12), so it has to be a
 * real scrollable list at Full, keyboard-reachable, not a decorative overlay.
 *
 * Scroll is locked below Full and handed to the inner list at Full, so a drag
 * that starts on a row doesn't fight the list underneath it.
 */
export type Snap = "peek" | "half" | "full";

/** Fractions of viewport height, matching the table in §8.1. */
export const HEIGHTS: Record<Snap, string> = {
  // Measured from the viewport's bottom edge, which the floating tab bar
  // covers to 88px plus the home-indicator inset (AppShell). A flat 120px
  // left about 30px of sheet showing above the bar — the handle and nothing
  // else, so "peek" showed no times at all. This keeps the header line and
  // the first row in view over the bar.
  peek: "calc(176px + env(safe-area-inset-bottom))",
  half: "50vh",
  full: "92vh",
};

const ORDER: Snap[] = ["peek", "half", "full"];

export default function BottomSheet({
  snap,
  onSnapChange,
  children,
  label,
}: {
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  children: ReactNode;
  label: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; time: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const move = useCallback(
    (direction: 1 | -1) => {
      const index = ORDER.indexOf(snap);
      const next = Math.min(ORDER.length - 1, Math.max(0, index + direction));
      if (next !== index) onSnapChange(ORDER[next]);
    },
    [snap, onSnapChange],
  );

  function onPointerDown(event: ReactPointerEvent) {
    start.current = { y: event.clientY, time: Date.now() };
    setDrag(0);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (!start.current) return;
    setDrag(event.clientY - start.current.y);
  }

  function onPointerUp(event: ReactPointerEvent) {
    if (!start.current) return;
    const dy = event.clientY - start.current.y;
    const dt = Date.now() - start.current.time;
    start.current = null;
    setDrag(null);

    // A flick counts even when short: velocity, not just distance.
    const velocity = Math.abs(dy) / Math.max(dt, 1);
    const decisive = Math.abs(dy) > 48 || velocity > 0.4;
    if (!decisive) return;
    move(dy > 0 ? -1 : 1);
  }

  // Escape collapses rather than closes — there is nothing behind the sheet
  // but the map, and dismissing it entirely would strip the only list view.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && snap !== "peek") {
        event.preventDefault();
        onSnapChange("peek");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [snap, onSnapChange]);

  const height = HEIGHTS[snap];

  return (
    <section
      ref={panel}
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-xl border-t border-line bg-surface shadow-sheet"
      style={{
        height: drag != null ? `calc(${height} - ${drag}px)` : height,
        maxHeight: "92vh",
        transition:
          drag != null ? "none" : "height var(--base) var(--spring)",
      }}
    >
      <div
        role="slider"
        tabIndex={0}
        aria-label="Resize results"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={ORDER.indexOf(snap)}
        aria-valuetext={snap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); move(1); }
          if (e.key === "ArrowDown") { e.preventDefault(); move(-1); }
        }}
        className="flex h-11 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <span className="h-1 w-10 rounded-full bg-surface-2" aria-hidden="true" />
      </div>

      <div
        className={
          "min-h-0 flex-1 " + (snap === "full" ? "overflow-y-auto" : "overflow-hidden")
        }
      >
        {children}
      </div>
    </section>
  );
}
