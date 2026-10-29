# The Owlery · Hog Wumbia admin

Week 6's separate admin app, sharing the existing Hog Wumbia Supabase project. The public creation/rating app lives at [siriusblanck/tristans-humor](https://github.com/siriusblanck/tristans-humor).

## What it does

- Overview: all-time profiles, posts, votes, approval percentage; 14-day activity; weekly net house points; most-used characters; most divisive post (largest number of opposing vote pairs).
- Profiles: read/search all profiles, houses, staff flags, contribution counts and join dates.
- Media: paginated searchable library; create a real AI caption and image using the public app's character prompts and quotas; read original prompts/models; update caption and accessibility description; delete the media and associated votes/image.
- Votes: read/search individual upvotes/downvotes with member and post links.
- Prompts — Prompt chains (read), Chain steps (read), Chain mix (read/update weights), Examples (CRUD), Terms (CRUD).
- Activity — Generation requests (read), LLM responses (read).
- Models — LLM providers (CRUD), LLM models (CRUD).
- Access — Signup domains (CRUD), Email whitelist (CRUD).

Profiles and votes are intentionally read-only, matching the assignment; prompt chains, chain steps, generation requests, and LLM responses are read-only for the same reason, and chain mix is update-only. Creating media publishes it under the signed-in administrator's own profile and house. It uses the same weekly topic and 3-per-user / 100-global daily limits as the public app. Voting counters and house points remain database-derived.

## Access boundary

Every admin page and every data operation/action verifies `auth.getUser()`, requires Google as the account provider, and reads `profiles.is_superadmin === true` from the database. Checks happen before constructing a service-role client. No session flag, user-editable metadata, submitted author ID, or hidden navigation control grants access. The service key is server-only. Normal RLS rules and column-level grants remain intact; users cannot update `is_superadmin`.

`/login`, `/auth/callback`, and static assets are public entry points with no admin data. All-time metrics use actual records, including negative net scores; zero-vote approval is shown as an em dash.

Every dashboard route lives in the protected `(admin)` layout and every read/mutation independently checks access, including the catalog's generic `/<section>`, `/<section>/new`, and `/<section>/<id>` routes. A section key is only ever looked up in an allowlisted registry; it never reaches a table or column name directly. Auth responses use `private, no-store`. Role revocation takes effect on the next request.

The migration `supabase/migrations/20261022000000_admin_access.sql` was applied through the original app's linked migration history; a matching copy is kept here for this app's setup. Apply it only once to the shared database.

### Bootstrapping the first administrator

This is an operator action, not a signup feature. Sign in to the public app with Google, complete the profile, then use the Supabase SQL editor or authenticated CLI to find the exact account and set the flag:

```sql
select id, email from auth.users where email = 'your-google-email';
update public.profiles set is_superadmin = true where id = 'verified-user-uuid';
```

The owner's Columbia account is provisioned. Other users remain denied. To revoke access, set the same field to false. Never grant access using a broad name match or expose promotion in the client.

## Catalog data

The catalog's 11 tables (LLM providers/models, prompt chains, chain steps, chain mix, generation examples, terms, generation requests, LLM responses, signup domains, email whitelist) live in `supabase/migrations/20261029000000_admin_catalog.sql`. It was applied once to the shared `tristans-humor` project through the public app's linked migration history (commit `a551f42`); this repo keeps a matching copy and should not apply it again.

Every catalog table has RLS enabled with no policies, and `anon`/`authenticated` have all privileges revoked, so only the service role — used by this app after `requireAdmin()` — can read or write them. `supabase/tests/admin_catalog_rls.sql` checks this (run as `begin; ... rollback;`; 52 checks pass) along with row counts and the `updated_at` touch trigger.

The migration backfilled deterministic seed data from the existing public app rows: a Google provider with two Gemini models (text and image); one prompt chain per named character, each with a Caption step and an Illustration step; an equal-weight (`weight: 1`) mix row per chain; four Hog Wumbia vocabulary terms; up to five of the highest-scoring posts as generation examples; and, for every existing post, one `backfill`-sourced generation request plus its two LLM responses (caption and illustration). Signup domains seed with `columbia.edu` and `barnard.edu`; the email whitelist seeds empty.

Only the admin app's own "Create post" flow (in Media) logs new generation requests and LLM responses, tagged `source: "admin_app"`. Posts made through the public app only ever appear in this data via the one-time backfill — the public app does not write to these tables.

Signup domains, the email whitelist, and the chain mix weights are stored for future use but are not yet enforced or read by the public app; the relevant pages say so.

## Run

Use Node 22.13+ (or a compatible later LTS). Copy `.env.example` to `.env.local` and fill the existing shared project's values.

```sh
npm ci
npm run dev
```

The local app runs on port 3001. Allow `http://127.0.0.1:3001/auth/callback` and `http://localhost:3001/auth/callback` in Supabase Auth's redirect URLs, plus the deployed preview callback. Google continues to use the existing Supabase OAuth callback.

```sh
npm test
npm run test:coverage
npm run lint
npm run build
node --env-file=.env.local scripts/verify-access.mjs
```

The live integration script is restricted to localhost HTTP checks. It creates two temporary fixture users and a temporary media row/image, attacks self-promotion and route access, checks CRUD/vote cascading, and removes its fixtures in `finally`. It never edits real member records.

## Deployment

Separate GitHub repository: `siriusblanck/hogwumbia-admin`. Separate Vercel project: `raise-e9d2cfef/hogwumbia-admin`. Configure the four environment variables for preview, then deploy a clean commit. Vercel deployment protection is disabled for assignment access; the application's Google + database-role checks remain mandatory. Incognito visitors see the staff login.

## Maintenance notes

The AI pipeline is copied from the public app at `b4dbded` so this repository deploys independently. Keep character prompts/model adapters in sync when changing either app. Dashboard reads page through the full dataset for accurate statistics (no silent 1000-row truncation); for a much larger audience, move aggregates/search into protected database functions.

Deletion removes the database record first so a storage outage cannot leave a broken published card. If object deletion fails, the UI reports pending image cleanup. Original prompts/model IDs remain unchanged when editing a caption.
