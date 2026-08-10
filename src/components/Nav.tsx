import {
  adminPath,
  comparePath,
  listPath,
  mapPath,
  signInPath,
  type Route,
} from "../lib/route";
import { useAuth } from "../lib/auth";
import { authConfigured } from "../lib/supabase";

const TABS: { label: string; href: string; matches: Route["name"][] }[] = [
  { label: "Masjids", href: listPath, matches: ["list"] },
  { label: "Map", href: mapPath, matches: ["map"] },
  { label: "Compare a prayer", href: comparePath(), matches: ["compare"] },
];

export default function Nav({ route }: { route: Route }) {
  const { session, email, isAdmin, signOut } = useAuth();

  const tabs = isAdmin
    ? [...TABS, { label: "Suggestions", href: adminPath, matches: ["admin" as const] }]
    : TABS;

  return (
    <div className="space-y-2">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.matches.includes(route.name);
          return (
            <a
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-emerald-700 text-white"
                  : "bg-white text-stone-600 ring-1 ring-stone-200 hover:text-stone-900")
              }
            >
              {tab.label}
            </a>
          );
        })}
      </nav>

      {authConfigured && (
        <p className="text-xs text-stone-500">
          {session ? (
            <>
              Signed in as {email}
              {isAdmin && " · admin"} ·{" "}
              <button
                type="button"
                onClick={() => void signOut()}
                className="font-medium text-emerald-700 underline underline-offset-2"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              Browsing as a guest ·{" "}
              <a
                href={signInPath}
                className="font-medium text-emerald-700 underline underline-offset-2"
              >
                Sign in to suggest a time
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
