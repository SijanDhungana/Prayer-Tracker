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

const STORAGE_KEY = "prayer-tracker:asr";

const isPreference = (value: unknown): value is AsrPreference =>
  value === "masjid" || value === "hanafi" || value === "standard";

/** Reading storage can throw in private-mode Safari, so never let it break boot. */
function readStored(): AsrPreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "masjid";
  } catch {
    return "masjid";
  }
}

interface Settings {
  asr: AsrPreference;
  setAsr: (value: AsrPreference) => void;
}

const SettingsContext = createContext<Settings>({
  asr: "masjid",
  setAsr: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [asr, setAsrState] = useState<AsrPreference>(readStored);

  const setAsr = useCallback((value: AsrPreference) => {
    setAsrState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // A visitor with storage disabled still gets the choice for this visit.
    }
  }, []);

  // Keep two open tabs in step: a preference changed in one is a preference,
  // not a per-tab mode.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isPreference(event.newValue)) {
        setAsrState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ asr, setAsr }), [asr, setAsr]);

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
