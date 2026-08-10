import { comparePath, listPath, type Route } from "../lib/route";

const TABS: { label: string; href: string; matches: Route["name"][] }[] = [
  { label: "Masjids", href: listPath, matches: ["list"] },
  { label: "Compare a prayer", href: comparePath(), matches: ["compare"] },
];

export default function Nav({ route }: { route: Route }) {
  return (
    <nav className="flex gap-2">
      {TABS.map((tab) => {
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
  );
}
