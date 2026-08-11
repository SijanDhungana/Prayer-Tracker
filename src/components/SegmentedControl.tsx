import { useRef, type ReactNode } from "react";

/**
 * One segmented control, used by the prayer selector, the theme switch, Plan's
 * options and the Suggestions filter — design spec v2 §11.
 *
 * Radiogroup semantics rather than buttons (§8.3), which means arrow keys move
 * between options and only the selected one is a tab stop. A row of buttons
 * would make a five-option control five tab stops and tell a screen reader
 * nothing about them being one choice.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional second line, e.g. the live Asr preview time. */
  hint?: ReactNode;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  scrollable = false,
  accent = "brand",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Overflow-scroll instead of equal widths, for the six-prayer selector. */
  scrollable?: boolean;
  /** "now" tints the active thumb with the prayer accent (§8.2). */
  accent?: "brand" | "now";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;

    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={
        "flex gap-1 rounded-full bg-surface-2 p-1 " +
        (scrollable ? "overflow-x-auto" : "")
      }
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // Only the active option is a tab stop; arrows move within.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={
              "min-h-[44px] shrink-0 rounded-full px-4 text-body font-medium transition-colors " +
              (scrollable ? "" : "min-w-0 flex-1 ") +
              (selected
                ? accent === "now"
                  ? "bg-now-wash text-now"
                  : "bg-brand text-brand-ink"
                : "text-ink-2 hover:text-ink")
            }
            style={{ transitionDuration: "var(--fast)" }}
          >
            {option.label}
            {option.hint != null && (
              <span className="ml-2 text-meta text-ink-3">{option.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
