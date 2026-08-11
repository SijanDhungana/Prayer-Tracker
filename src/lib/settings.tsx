import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Masjid } from "./types";

/**
 * Which school's Asr the visitor follows.
 *
 * Asr is the one prayer whose calculated time depends on the school: Hanafi
 * waits until an object's shadow is twice its length, everyone else until it
 * is once. The gap is roughly an hour, which is far too big to paper over.
 *
 * "masjid" is the default and means "whatever each masjid itself calculates",
 * which is what the directory already records per masjid. It is the safe
 * default precisely because it is the status quo: nobody's times change until
 * they ask for a change. Guessing wrong in either direction is harmful — show
 * a Hanafi visitor the standard time and they may pray before Asr has begun
 * for them; show a Shafi visitor the Hanafi time and they may think Asr has
 * not started when it has.
 */
export type AsrPreference = "masjid" | "hanafi" | "standard";

export const ASR_LABELS: Record<AsrPreference, string> = {
  masjid: "Match each masjid",
  hanafi: "Hanafi",
  standard: "Standard",
};

export const ASR_NOTES: Record<AsrPreference, string> = {
  masjid: "Use whatever school each masjid calculates with. The default.",
  hanafi: "Shadow twice an object's length — Asr about an hour later.",
  standard: "Shadow once an object's length — Shafi, Maliki and Hanbali.",
};

/**
 * Light, dark, or whatever the device says — design spec §4.
 *
 * "system" is the default and writes no attribute at all, leaving the
 * prefers-color-scheme block in tokens.css to decide. An explicit choice
 * stamps data-theme on <html>, which both token blocks are written to
 * respect, so the switch wins in either direction.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const STORAGE_KEY = "prayer-tracker:asr";
const THEME_KEY = "prayer-tracker:theme";
const HOME_KEY = "prayer-tracker:home-masjid";

const isPreference = (value: unknown): value is AsrPreference =>
  value === "masjid" || value === "hanafi" || value === "standard";

const isTheme = (value: unknown): value is Theme =>
  value === "system" || value === "light" || value === "dark";

/** Reading storage can throw in private-mode Safari, so never let it break boot. */
function readStored(): AsrPreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "masjid";
  } catch {
    return "masjid";
  }
}

/**
 * The masjid you actually attend.
 *
 * Distinct from favourites: favourites are a shortlist, this is *the* one, so
 * its next congregation can be answered without scanning a list at all. An id
 * that no longer exists in the directory resolves to nothing rather than
 * throwing — masjids can be renamed or merged between deploys.
 */
function readHome(): string | null {
  try {
    return window.localStorage.getItem(HOME_KEY);
  } catch {
    return null;
  }
}

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

interface Settings {
  asr: AsrPreference;
  setAsr: (value: AsrPreference) => void;
  theme: Theme;
  setTheme: (value: Theme) => void;
  homeMasjidId: string | null;
  setHomeMasjidId: (value: string | null) => void;
}

const SettingsContext = createContext<Settings>({
  asr: "masjid",
  setAsr: () => {},
  theme: "system",
  setTheme: () => {},
  homeMasjidId: null,
  setHomeMasjidId: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [asr, setAsrState] = useState<AsrPreference>(readStored);
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [homeMasjidId, setHomeState] = useState<string | null>(readHome);

  const setAsr = useCallback((value: AsrPreference) => {
    setAsrState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // A visitor with storage disabled still gets the choice for this visit.
    }
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
    try {
      window.localStorage.setItem(THEME_KEY, value);
    } catch {
      // Storage off: the choice still holds for this visit.
    }
  }, []);

  const setHomeMasjidId = useCallback((value: string | null) => {
    setHomeState(value);
    try {
      if (value) window.localStorage.setItem(HOME_KEY, value);
      else window.localStorage.removeItem(HOME_KEY);
    } catch {
      // Storage off: the choice still holds for this visit.
    }
  }, []);

  // "system" removes the attribute rather than setting it to a value, so the
  // prefers-color-scheme block is what applies — not a third code path.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  // Keep two open tabs in step: a preference changed in one is a preference,
  // not a per-tab mode.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isPreference(event.newValue)) {
        setAsrState(event.newValue);
      }
      if (event.key === THEME_KEY && isTheme(event.newValue)) {
        setThemeState(event.newValue);
      }
      if (event.key === HOME_KEY) setHomeState(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ asr, setAsr, theme, setTheme, homeMasjidId, setHomeMasjidId }),
    [asr, setAsr, theme, setTheme, homeMasjidId, setHomeMasjidId],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

/**
 * Rewrite each masjid's madhab to the visitor's choice.
 *
 * Applied once, high up, to the same list every view already receives — so a
 * preference reaches every calculation in the app without each call site
 * having to remember to ask for it. A view that forgot would quietly show an
 * Asr an hour out, which is exactly the kind of mistake this app cannot make.
 *
 * Only the *adhan* moves. A masjid's iqamah is a clock time its committee
 * chose, and no visitor preference should rewrite what a masjid published.
 */
export function applyAsrPreference(
  masjids: Masjid[],
  preference: AsrPreference,
): Masjid[] {
  if (preference === "masjid") return masjids;

  const madhab = preference === "hanafi" ? "hanafi" : "shafi";

  return masjids.map((masjid) =>
    masjid.calc.madhab === madhab
      ? masjid
      : { ...masjid, calc: { ...masjid.calc, madhab } },
  );
}
