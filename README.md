# Nutrition OS

**Eat · Plan · Live Better.** An intelligent personal and household nutrition command center, implemented in phases from the Nutrition OS architecture.

## Status
- **Phase 0:** Fresh repository bootstrap and architectural reconciliation.
- **Phase 1:** Premium interactive **frontend preview**. All meal records, metrics, recommendations, grocery quantities, and family references are **sample data** and remain in browser memory only. This is NOT an authenticated system or medical advice.
- **Phase 2:** Personal nutrition screens — onboarding, profile, Today, Meals, Foods, Recipes, Goals and Progress — are implemented as a **frontend-only interactive preview**, with date-aware meal records, corrections, recipe snapshots, editable example targets and observed-data charts.
- **Phase 3:** Weekly meal plans, generated groceries with pantry deductions, shopping-cost and spending separation, append-only inventory ledger, budget comparisons and waste/expiry tracking — **frontend-only preview**.
- **Phase 4:** Nutrition intelligence preview and privacy-bounded family command center implemented.
- **Phase 5:** Real PostgreSQL/Fastify backend with signed identity boundary, domain APIs, tenant RLS, transactions, idempotency, audit and outbox events. **Frontend is not yet connected to the backend.**
- **Phase 6:** Signed-in React workspace connected to PostgreSQL REST APIs, with durable personal and resource workflows and explicit secure family kitchen sharing. The original mock is a **separate preview**, not fallback data.
- **Phases 7–8:** Personal Kernel identity/consent integrations and production certification remain future work.

## Local run
```sh
npm install
npm run dev
npm run check
npm run test
npm run build
```

## GitHub Pages
When Pages is configured to use **GitHub Actions** as its build/deployment source, pushes to `main` trigger `.github/workflows/pages.yml`. Vite uses relative assets and hash routes, so the app can run under `/Nutrition-Os/`.

## Structure
```text
src/
  domain/         deterministic frontend preview calculations
  data/           typed and clearly marked sample fixtures
  ui/             dashboard, personal experience, reusable design language
  domain/personal.ts     example profile, goals, recipe and date calculations
  data/foodLibrary.ts   additional illustrative foods
  data/personalFixtures.ts  illustrative recipes
docs/
  ARCHITECTURE_RECONCILIATION.md
  PHASE_DELIVERY.md
.github/workflows/
  ci.yml          type-check, test and bundle
  pages.yml       publish static preview from main
```

## Governance
Do not treat dashboard scores as actual clinical states. Missing meal logs are incomplete observations, not observed absence of intake. Family-only shared logistics are surfaced separately from sensitive individual health state. Integrations, authentication, AI calls and persistence are not implemented in Phases 0–1.

## Phase 2 handoff
See [Phase 2 delivery](docs/PHASE_2_DELIVERY.md) for implemented screens and data boundaries. All edits remain in memory: refreshing the page resets the example workspace. Pages still needs repository-level activation before the site can be verified live.

### Phase 3 resource handoff
See [Phase 3 implementation](docs/PHASE_3_DELIVERY.md). Stocks are in example food servings; KES prices are made-up estimates. Changes reset after page reload and no financial or health services are called.

### Phase 4 -- Intelligence & Family Command Center
`Insights`, `AI Nutrition Guide`, and `Family` now provide connected, deterministic frontend experiences. Insights use observed meals, source notes, confidence labels and feedback; assistant responses are read-only and block sensitive clinical requests; family coordination uses shared plans, groceries and kitchen tasks, never other members' nutrition records. No model provider, data persistence, real consent/identity integration or clinical validation exists. See [Phase 4 delivery](docs/PHASE_4_DELIVERY.md).

Phase 4 dashboard note: weekly figures are now derived from observed meal dates, approved plan entries and the active example grocery list; missing days do not receive fabricated scores.


### Phase 5 — Local backend
The Node API in `server/` is separately installed and deployed. GitHub Pages only hosts the Vite frontend; it cannot host this API or PostgreSQL.

```bash
docker compose -f docker-compose.backend.yml up -d
npm --prefix server install
cp server/.env.example server/.env
npm --prefix server run db:migrate
npm --prefix server run dev
# in another terminal
npm --prefix server run dev:token
```

The example database passwords and local token workflow are **development-only**. Never run the HTTP server as the PostgreSQL superuser. Live identity relies on Personal Kernel JWKS in future phases, and no backend demo records are seeded. See [Phase 5 delivery](docs/PHASE_5_DELIVERY.md) and [API contracts](docs/PHASE_5_API_CONTRACT.md).


### Phase 6 — API-backed Nutrition OS
Local Vite defaults to authenticated live mode (requires a short-lived local development token from the server); use `?mode=preview` for the original sample frontend. GitHub Pages remains a standalone, labeled sample preview because production Personal Kernel sign-in is not connected. No real account data or JWTs are included in the static build. Run PostgreSQL migrations 001–004 and the independent backend first. See docs/PHASE_6_DELIVERY.md and docs/PHASE_6_API_ADDENDUM.md.
