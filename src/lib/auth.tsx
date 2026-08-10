import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { authConfigured, getSupabase, type Role } from "./supabase";

interface AuthState {
  /** null while the initial session check is still running. */
  loading: boolean;
  session: Session | null;
  email: string | null;
  role: Role | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(authConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const pending = getSupabase();
    if (!pending) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void pending.then(async (client) => {
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);

      const { data: sub } = client.auth.onAuthStateChange((_event, next) =>
        setSession(next),
      );
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // The role is read from the database, never from anything the browser holds —
  // a token can be inspected but the profiles policies decide what comes back.
  useEffect(() => {
    const pending = getSupabase();
    if (!pending || !session) {
      setRole(null);
      return;
    }
    let cancelled = false;
    void pending.then(async (client) => {
      const { data } = await client
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled) setRole((data?.role as Role) ?? "user");
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const pending = getSupabase();
    if (!pending) return "Accounts aren't set up on this deployment.";
    const { error } = await (
      await pending
    ).auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const pending = getSupabase();
    if (!pending) return "Accounts aren't set up on this deployment.";
    const { error } = await (await pending).auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    const pending = getSupabase();
    if (pending) await (await pending).auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      email: session?.user.email ?? null,
      role,
      isAdmin: role === "admin",
      signIn,
      signUp,
      signOut,
    }),
    [loading, session, role, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
