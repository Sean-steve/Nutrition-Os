# Nutrition OS

**Eat · Plan · Live Better.** An intelligent personal and household nutrition command center, implemented in phases from the Nutrition OS architecture.

## Status
- **Phase 0:** Fresh repository bootstrap and architectural reconciliation.
- **Phase 1:** Premium interactive **frontend preview**. All meal records, metrics, recommendations, grocery quantities, and family references are **sample data** and remain in browser memory only. This is NOT an authenticated system or medical advice.
- **Phase 2:** Personal nutrition screens — onboarding, profile, Today, Meals, Foods, Recipes, Goals and Progress — are implemented as a **frontend-only interactive preview**, with date-aware meal records, corrections, recipe snapshots, editable example targets and observed-data charts.
- **Phase 3:** Weekly meal plans, generated groceries with pantry deductions, shopping-cost and spending separation, append-only inventory ledger, budget comparisons and waste/expiry tracking — **frontend-only preview**.
- **Phases 4–8:** Intelligence, real APIs, PostgreSQL, Kernel integration and production certification are future work.

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
