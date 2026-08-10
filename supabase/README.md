# Accounts and suggestions — setup

Four steps, once. Until they're done the site runs exactly as before: everyone
browses as a guest, prayer times come from `src/data/masjids.json`, and the
suggestion UI says accounts aren't set up.

## 1. Create the project

[supabase.com](https://supabase.com) → New project. The free tier is enough.
Note the **Project URL** and the **anon public key** from Settings → API.

## 2. Create the tables

Dashboard → SQL Editor → New query. Paste all of [`schema.sql`](./schema.sql)
and run it. That creates the `profiles` and `suggestions` tables, the
`approved_times` view the app reads, and the row-level security policies that
actually enforce who may do what.

## 3. Point the app at it

In Vercel → Settings → Environment Variables, add:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |

Both are safe in the browser — the anon key is public by design, and the
policies from step 2 are what stop a signed-in user from approving their own
suggestion. Redeploy for them to take effect.

## 4. Make yourself an admin

Sign up through the app first, so your account exists. Then in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Reload the app — a **Suggestions** tab appears in the nav.

## How it fits together

- **Guests** see everything: masjids, adhan times, iqamah times, comparisons.
- **Signed-in users** can additionally suggest a time. The row is written as
  `pending` and is invisible to everyone but its author and admins.
- **Admins** see every suggestion at `#/admin/suggestions` and can verify or
  reject it. Verifying publishes that time to everyone **immediately** — the app
  layers approved corrections over `masjids.json` at load, so there is no commit
  and no redeploy in the loop.
- **The scraper** keeps updating `masjids.json` daily underneath. An approved
  correction outranks it, because a person checked it.

## If Supabase is down

The prayer times still render. They come from the static JSON in the bundle;
the corrections fetch fails quietly and the baseline stands. Verified by
building against an unreachable host: all masjids render, no errors.
