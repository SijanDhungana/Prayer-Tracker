import { useState } from "react";
import { useAuth } from "../lib/auth";
import { authConfigured } from "../lib/supabase";
import { listPath } from "../lib/route";

export default function SignIn() {
  const { signIn, signUp, email: signedInAs } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authConfigured) {
    return (
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-3 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          Accounts aren&rsquo;t set up on this deployment yet. Prayer times work
          normally without one — signing in is only needed to suggest a
          correction.
        </p>
        <a
          href={listPath}
          className="mt-4 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        >
          ← All masjids
        </a>
      </section>
    );
  }

  if (signedInAs) {
    return (
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
        <p className="mt-2 text-sm text-stone-600">
          You&rsquo;re signed in as {signedInAs}.
        </p>
        <a
          href={listPath}
          className="mt-4 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        >
          ← All masjids
        </a>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "in" ? "Sign in" : "Create an account"}
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        An account is only needed to suggest a prayer time. Browsing works
        without one.
      </p>

      <form
        className="mt-5 rounded-xl border border-stone-200 bg-white p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setNotice(null);
          const message =
            mode === "in"
              ? await signIn(email, password)
              : await signUp(email, password);
          setBusy(false);
          if (message) {
            setError(message);
          } else if (mode === "up") {
            setNotice(
              "Account created. Check your email if confirmation is required, then sign in.",
            );
          } else {
            window.location.hash = "/";
          }
        }}
      >
        <label className="block text-sm font-medium text-stone-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-stone-50 px-3 py-2 text-base font-normal text-stone-900 ring-1 ring-stone-200"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-stone-700">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-stone-50 px-3 py-2 text-base font-normal text-stone-900 ring-1 ring-stone-200"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "in" ? "up" : "in");
          setError(null);
          setNotice(null);
        }}
        className="mt-3 text-sm font-medium text-emerald-700 underline underline-offset-2"
      >
        {mode === "in"
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
