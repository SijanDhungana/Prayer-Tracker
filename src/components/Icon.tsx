/**
 * The app's one icon set — design spec v2 §15: "one icon set throughout
 * (Lucide or Phosphor, 22px, 1.75px stroke)", and no emoji as UI icons.
 *
 * Lucide geometry, inlined rather than pulled in as a dependency: fourteen
 * icons do not justify shipping a library, and inlining keeps them on the
 * same stroke and grid as each other.
 *
 * Every icon is decorative (§12): aria-hidden, always paired with a real
 * text label by its caller.
 */
import type { SVGProps } from "react";

export type IconName =
  | "map-pin"
  | "route"
  | "clock"
  | "mosque"
  | "settings"
  | "search"
  | "star"
  | "star-filled"
  | "x"
  | "crosshair"
  | "chevron-right"
  | "chevron-down"
  | "arrow-right"
  | "phone"
  | "globe"
  | "check"
  | "sliders"
  | "inbox";

const PATHS: Record<IconName, JSX.Element> = {
  "map-pin": (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  mosque: (
    <>
      <path d="M12 2s3 2.5 3 5a3 3 0 0 1-6 0c0-2.5 3-5 3-5" />
      <path d="M4 21v-6a8 8 0 0 1 16 0v6" />
      <path d="M2 21h20" />
      <path d="M10 21v-4a2 2 0 1 1 4 0v4" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  star: (
    <path d="M11.5 3.2a.6.6 0 0 1 1 0l2.3 4.7 5.2.7a.6.6 0 0 1 .3 1l-3.7 3.6.9 5.1a.6.6 0 0 1-.9.6L12 16.5l-4.6 2.4a.6.6 0 0 1-.9-.6l.9-5.1L3.7 9.6a.6.6 0 0 1 .3-1l5.2-.7z" />
  ),
  "star-filled": (
    <path
      d="M11.5 3.2a.6.6 0 0 1 1 0l2.3 4.7 5.2.7a.6.6 0 0 1 .3 1l-3.7 3.6.9 5.1a.6.6 0 0 1-.9.6L12 16.5l-4.6 2.4a.6.6 0 0 1-.9-.6l.9-5.1L3.7 9.6a.6.6 0 0 1 .3-1l5.2-.7z"
      fill="currentColor"
    />
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  crosshair: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </>
  ),
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "arrow-right": <path d="M5 12h14M12 5l7 7-7 7" />,
  phone: (
    <path d="M13.8 10.2a11 11 0 0 0 4.6 4.6l1.5-1.5a1.3 1.3 0 0 1 1.3-.3c1 .3 2.1.5 3.2.5H24v3.3A1.7 1.7 0 0 1 22.3 19 18.3 18.3 0 0 1 4 .7 1.7 1.7 0 0 1 5.7-1H9v.3c0 1.1.2 2.2.5 3.2a1.3 1.3 0 0 1-.3 1.3z" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="7" cy="18" r="2" fill="currentColor" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" />
    </>
  ),
};

export default function Icon({
  name,
  size = 22,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
