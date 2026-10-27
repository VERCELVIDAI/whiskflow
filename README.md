# Whisk Flow

**Shape the story. Direct the frame.**

Whisk Flow is a production-minded AI filmmaking and creative studio built with Next.js. It brings prompt development, reference boards, storyboard scenes, image/video generation, media management, projects, plans and credit accounting into one calm, cinematic workspace inspired by Google Flow.

The app is fully explorable without provider credentials: projects, storyboards, references, uploads, folders, favorites, templates, plans and the prompt assistant all work locally. Generation screens state exactly which server environment variables are missing instead of pretending to generate. Billing runs in a clearly labelled demo mode on a local workspace, or hands off to Stripe Checkout when configured.

Source code: [github.com/VERCELVIDAI/whisk-flow](https://github.com/VERCELVIDAI/whisk-flow).

---

## What is included

- **Flow-style dark studio** with a cinematic near-black canvas, collapsible sidebar, contextual inspector, pill navigation, mobile bottom bar and a light “paper” theme. Dark is the default; the stored preference is respected.
- **Home dashboard** with an interactive hero carousel, prompt composer, recent projects, media rail, featured templates and plan status.
- **Create studio** for video, image and storyboard work, with model-aware controls (aspect ratio, resolution, duration, outputs, references, first/last frames, audio where supported).
- **Project workspace** with an editable storyboard, scene reordering, prompt history, autosave states (`Saving…` / `Saved` / error), generation status, a timeline/player, assets, export history and a contextual inspector that is empty until something is selected.
- **My Media** with private uploads, drag-and-drop, validation, folders, favorites, search, pagination, lightbox actions, trash and restore.
- **Templates** with editable defaults and clearly labelled sample output.
- **Credits** with server-authoritative estimates, reservation, capture/refund, a ledger and usage history. Credits are app-defined workspace units, not provider USD.
- **Plans & billing** at `/pricing`: Starter (free), Creator, Studio and Production, monthly or annual (10× monthly, two months free), plus one-time credit packs. Stripe Checkout and the Billing Portal are used when configured; a local workspace uses a clearly labelled demo checkout that never charges a card.
- **Auth** with local email/password accounts (scrypt + signed HTTP-only cookies) and Supabase Auth when configured. Password reset, change password, profile editing and protected studio routes are included.
- **Provider adapters** for Google Gemini (Interactions API), OpenAI and JSON2Video with server-only keys, capability discovery, async video polling, timeouts, retries, idempotency and honest error messages.
- **Whisk Flow 1.1**, a 10-second text-led motion-graphics renderer powered by JSON2Video: designed cinematic backgrounds, animated typography and a finished MP4 in 16:9, 9:16, 1:1 or 4:5 at 720p or 1080p.
- **Responsive shell** with a collapsible sidebar, mobile navigation, command palette, keyboard focus states and reduced-motion support.
- **Automated checks**: 132 Vitest tests across 17 files, ESLint, TypeScript and a production build.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn-style primitives, Lucide, Framer Motion |
| Data | PostgreSQL (Supabase) in production; embedded PGlite locally |
| Auth | Supabase Auth or local scrypt/HMAC sessions |
| Storage | Supabase private bucket or `.data/uploads` locally |
| Validation | Zod + React Hook Form |
| Tests | Vitest |

The database schema is shared between local PGlite (`db/schema.sql`) and Supabase (`supabase/migrations/0001_whisk_flow.sql`).

---

## Quick start (no credentials needed)

Requirements: **Node.js 20.18+** and npm.

```bash
npm install
cp .env.example .env.local   # optional for local mode
npm run dev
```

Open <http://localhost:3000>.

Use the local demo account:

```text
Email:    demo@whiskflow.studio
Password: demo-flow
```

The demo account and its example projects are created on first use. To seed explicitly (and to re-seed example content for another local account):

```bash
npm run db:seed
```

Local data lives under `.data/` and is gitignored:

- `.data/whisk-flow-db` — PGlite database
- `.data/uploads` — uploaded media
- `.data/auth-secret` — generated local session secret (development only)

> The local auth/database/storage mode is for development and single-machine use. PGlite and local files are not durable across serverless instances. Use Supabase for any deployed or multi-user environment.

---

## Demo account and seeding

`npm run db:seed` is idempotent. It creates or reuses the account and inserts projects matched by owner + template slug.

```bash
# Local demo account (default)
npm run db:seed

# Custom local account
SEED_EMAIL=you@example.com SEED_PASSWORD=your-password SEED_NAME="Your Name" npm run db:seed

# Only the two welcome examples (no demo-only projects)
SEED_SCOPE=welcome npm run db:seed

# Supabase/PostgreSQL: profile must already exist
SEED_EMAIL=you@example.com npm run db:seed
```

In Supabase mode, sign up in the app first so the `profiles` row and auth user exist. The script only seeds content; it does not create Supabase Auth users. See `scripts/seed.ts` for details.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Watch mode |
| `npm run db:seed` | Seed demo/example content |

Recommended pre-deploy check:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

---

## Configuration

Copy `.env.example` to `.env.local`. Every value is optional for local exploration; provider keys enable real generation, and Supabase values switch the app to production infrastructure.

### App

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public origin used for auth redirects (default `http://localhost:3000`) |
| `AUTH_SECRET` | 32+ character HMAC secret for local sessions. Required for local auth in production; generated under `.data/` in development |
| `MAX_IMAGE_UPLOAD_MB` | Image upload limit (default `15`) |
| `MAX_VIDEO_UPLOAD_MB` | Video upload limit (default `100`) |

### Supabase (production)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key used by the browser client |
| `SUPABASE_SECRET_KEY` | Server-only secret/service key for storage and admin operations |
| `SUPABASE_SERVICE_ROLE_KEY` | Accepted alias for `SUPABASE_SECRET_KEY` |
| `DATABASE_URL` | Direct Postgres connection string (server-only; never expose it) |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name (default `whisk-media`) |

Setup:

1. Create a Supabase project.
2. In **Authentication → URL Configuration**, set the **Site URL** to your public origin (for local development, `http://localhost:3000`) and add `http://localhost:3000/auth/callback*` plus your production `https://your-domain/auth/callback*` to **Redirect URLs**. Email confirmation and password-reset links will not complete without these entries.
3. Run `supabase/migrations/0001_whisk_flow.sql` in the SQL editor. It creates the tables, indexes, profile trigger, RLS policies and the private `whisk-media` bucket with owner-scoped storage policies.
4. Add the Supabase values and `DATABASE_URL` to `.env.local`. `DATABASE_URL` is required: Supabase Auth handles sessions, while profiles and studio data live in Postgres. Use the direct connection string or the session pooler string from **Project Settings → Database**.
5. Restart the app, register a real account, and optionally seed examples with `SEED_EMAIL=you@example.com npm run db:seed`.

If you rename the bucket, update the storage policies in the migration to match. Keep the bucket private.

> **Email confirmation:** If confirmation is enabled in Supabase, the registration form shows a “check your inbox” state. The link returns through `/auth/callback`, which exchanges the code for a session. If confirmation is disabled, the user is signed in immediately after registration.

> **Troubleshooting login:** A stale local session cookie can no longer trap you in a `/login` redirect loop. If you still see a redirect loop after switching to Supabase, clear the site cookies once. A `503` mentioning `DATABASE_URL` means Supabase Auth is configured but the Postgres connection string is missing.

### AI providers (optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Google image, video and prompt-assistant calls |
| `OPENAI_API_KEY` | — | OpenAI image and prompt-assistant calls |
| `JSON2VIDEO_API_KEY` | — | Whisk Flow 1.1 motion-graphics renders |
| `GEMINI_IMAGE_MODEL` | `gemini-nano-banana-2.1` | Google image model |
| `GEMINI_VIDEO_MODEL` | `gemini-omni-1.1-flash` | Google video model |
| `GEMINI_TEXT_MODEL` | `gemini-3.8-flash` | Google prompt assistant |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.5-flare` | OpenAI fast image model |
| `OPENAI_PRECISION_IMAGE_MODEL` | `gpt-image-2.5-sunburst` | OpenAI precision image model |
| `OPENAI_TEXT_MODEL` | `gpt-6-luna` | OpenAI prompt assistant |
| `JSON2VIDEO_MODEL` | `whisk-flow-1.1` | Whisk Flow 1.1 catalog ID |
| `CREDIT_COST_OVERRIDES` | — | JSON map of model ID to app credits |

Provider keys are read only on the server. The browser receives a catalog containing model capabilities and availability flags, never keys.

Google generation uses the Interactions API with the `x-goog-api-key` header and `Api-Revision: 2026-05-20`; video jobs run in the background and are polled. OpenAI uses the Images and Responses APIs. JSON2Video renders are created with `POST /v2/movies`, polled with `GET /v2/movies?project=…`, then downloaded into private app storage. Models that require a provider key remain visible in the UI with a setup-needed label rather than being silently hidden.

### Whisk Flow 1.1 (JSON2Video)

Whisk Flow 1.1 is a **renderer**, not a photoreal text-to-video model. It turns the prompt into a designed 10-second title/motion-graphics sequence: a cinematic HTML background, animated typography and a finished MP4. It does not synthesize live-action footage, accept reference images, or generate audio.

| Property | Value |
| --- | --- |
| Provider | JSON2Video |
| Model ID | `whisk-flow-1.1` |
| Duration | 10 seconds, fixed |
| Aspect ratios | 16:9, 9:16, 1:1, 4:5 |
| Resolution | 720p, 1080p |
| Credits | 6 per second (60 per render) |
| References / first / last frame | Not supported |
| Audio | Not supported |
| Cancellation | Local only; JSON2Video cannot stop a render already in progress |

To enable it, add `JSON2VIDEO_API_KEY` to `.env.local` and restart the app. The key is used only by the server-side adapter. The model appears as **Whisk Flow 1.1 · Whisk Flow** in Create and Settings.

> **Watermark:** JSON2Video applies a `JSON2Video.com` watermark to videos rendered on its free plan. Paid JSON2Video plans remove it. The account used for this workspace is on the free plan, so renders include the watermark. Do not crop, cover or otherwise obscure it on free-plan output; upgrade the JSON2Video account to remove it at the source.

### Plans and billing (optional)

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-only Stripe secret key. Enables Checkout, the Billing Portal and subscription management |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/api/billing/webhook` endpoint. Required before checkout is enabled |

Billing resolves to one of three honest modes:

| Mode | When | Behaviour |
| --- | --- | --- |
| `stripe` | Both Stripe variables are set | Checkout redirects to Stripe; a signature-verified webhook fulfils the order and grants credits |
| `demo` | No Stripe keys, no `DATABASE_URL`, no Supabase configuration | Simulated checkout, labelled in the UI. Credits and the plan update immediately; no card is charged and no renewal is scheduled |
| `unconfigured` | Any other combination | The UI states what is missing and checkout returns `503 billing_not_configured` |

Demo mode is deliberately limited to a local workspace so a deployed app cannot mint free credits. The catalog in `lib/billing/plans.ts` is the only price source; the browser sends a plan or pack ID, never an amount. Credit grants and plan changes are transactional, and orders plus webhook event IDs are idempotent.

Stripe setup:

1. Add `STRIPE_SECRET_KEY` (a restricted key with Checkout, Billing Portal and Subscription write access is enough).
2. Add a webhook endpoint for `https://your-domain/api/billing/webhook` with these events: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Set `NEXT_PUBLIC_APP_URL` to the public origin so success/cancel URLs and the portal return URL are correct.

Checkout uses inline `price_data` from the server catalog, so no Stripe dashboard products are required. Webhook payloads are verified against the raw body with a 300-second timestamp tolerance; duplicate event IDs are ignored and failed handlers release the event for a Stripe retry.

### Credits

Credits are workspace units. Image models charge per output; video models charge per second of requested duration. Plan credits are granted when a subscription is fulfilled or renewed; credit packs never expire and do not change the plan. The server:

1. estimates the cost,
2. reserves credits atomically with a database check,
3. starts the provider job,
4. captures on success or refunds on failure/cancellation,
5. records every movement in `credit_transactions`.

Override costs with, for example:

```env
CREDIT_COST_OVERRIDES={"gemini-nano-banana-2.1":10,"gemini-omni-1.1-flash":8,"whisk-flow-1.1":6,"gpt-image-2.5-flare":12,"gpt-image-2.5-sunburst":20}
```

---

## Architecture

```text
app/
  (auth)/                 login, register, forgot/reset password
  (studio)/               home, create, projects, media, templates,
                          favorites, trash, pricing, usage, settings, help
  api/                    auth, projects, scenes, assets, generate, jobs,
                          media, catalog, templates, usage, billing, health
components/
  ui/                     shadcn-style primitives
  billing/                pricing, checkout and subscription UI
  create/                 creation studio and prompt assistant
  projects/               project workspace, storyboard, timeline, inspector
  media/                  media library, upload, lightbox, folders
  auth/                   auth forms
  shell/                  sidebar, top bar, mobile navigation, command palette
lib/
  auth/                   local crypto/session and Supabase auth
  billing/                plan catalog, Stripe REST adapter, billing service
  data/                   ownership-scoped data access
  db/                     PGlite/Postgres adapter and schema bootstrap
  generation/             generation orchestration, polling, credit flow
  providers/              Google/OpenAI/JSON2Video adapters, models, prompt fallback
  storage.ts              local/Supabase private media
  uploads.ts              upload MIME/size validation
db/
  schema.sql              local PGlite schema
  local-auth.sql          local credentials and reset tokens
supabase/
  migrations/             production schema, RLS and storage policies
scripts/
  seed.ts                 idempotent demo/example seeding
tests/                    Vitest suites and PGlite helpers
```

### Security notes

- Every data query filters by `owner_id`; RLS is enabled in Supabase as defense-in-depth.
- Uploaded media is private. Files are served through `/api/media/[id]`, which checks ownership; Supabase uses signed/private access.
- Provider and Supabase secret keys stay server-side. Client components receive sanitized catalog data.
- API inputs are validated with Zod. Errors returned to the browser are safe and do not include provider payloads or secrets.
- Local sessions use scrypt password hashes and HMAC-signed HTTP-only cookies. Changing or resetting a password increments `session_version`, invalidating old sessions.
- Local auth does not send email. Password reset links are written to the server log (and shown in the UI during development); use Supabase Auth for email delivery in production.
- Uploads are validated by MIME type and size before storage.
- Responses set basic security headers (`nosniff`, frame options, referrer policy, permissions policy).

---

## Testing

```bash
npm test
```

The suite covers auth and session handling, protected routes, project persistence, autosave, upload validation, prompt fallback, generation validation, provider errors, JSON2Video movie payloads, polling, MP4 download and render failures, credit reservation/capture/refund, billing catalog integrity, server-owned prices, demo checkout and idempotency, plan switching, cancellation, Stripe signature verification and fulfilment, unauthorized access, responsive contracts and UI states. Database tests use an in-memory PGlite instance and reset between files.

Typecheck, lint and production build:

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Deployment

Use **Supabase** for the database, auth and storage. The local PGlite/filesystem mode will not persist on Vercel.

1. Apply the migration and create the private bucket.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` and any provider keys in Vercel.
3. Add `AUTH_SECRET` if you use any local-auth fallback; Supabase Auth is recommended in production.
4. For payments, add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, then register the webhook endpoint described above. A deployment with a remote database and no Stripe keys reports billing as unconfigured rather than falling back to demo credits.
5. Deploy. `npm run build` is the build command.
6. Register the first account and seed examples if desired.

Provider video jobs are asynchronous; generation status is polled from the app. Long-running provider calls should fit within your hosting plan's function limits.

---

## Honest limitations

- **No provider keys are bundled.** Without `GEMINI_API_KEY`, `OPENAI_API_KEY` and/or `JSON2VIDEO_API_KEY`, generation requests return a clear `503 provider_not_configured` response and the UI explains which environment variables to add. Prompt refinement falls back to a clearly labelled local assistant.
- **Provider APIs evolve.** Model IDs and API revisions are configurable; validate them against your provider account before relying on a specific model in production.
- **Whisk Flow 1.1 is motion graphics, not photoreal footage.** It composes a designed background and animated typography; it does not create live-action scenes, accept reference images or produce audio. Use Google Gemini Omni or OpenAI for those capabilities when configured.
- **The JSON2Video free plan adds a watermark.** The account used here is on the free plan, so Whisk Flow 1.1 renders include `JSON2Video.com`. Paid JSON2Video plans remove it; free-plan terms prohibit cropping, covering or otherwise defeating it.
- **Sample media is original demo content**, labelled `Example` / `Sample clip`, and is not presented as generated output.
- **A real JSON2Video render was verified** in this environment: a 10-second 720p MP4 was created, downloaded into private storage, played in My Media, and captured 60 credits. Google Gemini and OpenAI calls were not run because no keys were available; those adapters and error paths are covered by tests with mocked HTTP responses.
- **No real Stripe payment was run in this environment** because no Stripe credentials were available. Signature verification, fulfilment, renewal credits and idempotency are covered by tests with signed fixtures. Demo checkout is simulated and never charges a card.
- **Plans and prices are product configuration**, not provider-verified pricing. Review `lib/billing/plans.ts` and your Stripe tax/currency settings before taking live payments.
- **Local mode is single-machine.** Do not use PGlite or `.data/uploads` for a deployed multi-user service.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `The Whisk Flow tables are missing` | Apply `supabase/migrations/0001_whisk_flow.sql`, then restart |
| `Supabase Auth is configured but DATABASE_URL is missing` | Add the direct Postgres connection string to `.env.local` |
| Generation says provider not configured | Add `GEMINI_API_KEY`, `OPENAI_API_KEY` and/or `JSON2VIDEO_API_KEY` to `.env.local` and restart |
| Whisk Flow 1.1 renders show a JSON2Video watermark | The JSON2Video account is on the free plan. Upgrade the JSON2Video plan to remove it; do not crop or cover it on free-plan output |
| Demo login unavailable | The shared demo account exists only in local mode; create a Supabase account instead |
| Upload rejected | Check MIME type and `MAX_IMAGE_UPLOAD_MB` / `MAX_VIDEO_UPLOAD_MB` |
| Seed cannot find a profile | In Supabase mode, sign up in the app before running `SEED_EMAIL=… npm run db:seed` |
| Reset link not visible | Local mode prints/returns the reset token in development; configure Supabase Auth email delivery in production |
| Pricing says billing is not configured | Add both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; a remote database never uses demo billing |
| Stripe checkout succeeds but credits do not appear | Check the webhook endpoint, signing secret and recent deliveries; the pricing page also reconciles the returned Checkout Session |
| Demo purchase appears in history | Expected on a local workspace: demo orders are recorded but no card is charged and no renewal is scheduled |
