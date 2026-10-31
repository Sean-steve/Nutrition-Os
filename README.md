# Nutrition OS

**Eat · Plan · Live Better.** An intelligent personal and household nutrition command center, implemented in phases from the Nutrition OS architecture.

## Status
- **Phase 0:** Fresh repository bootstrap and architectural reconciliation.
- **Phase 1:** Premium interactive **frontend preview**. All meal records, metrics, recommendations, grocery quantities, and family references are **sample data** and remain in browser memory only. This is NOT an authenticated system or medical advice.
- **Phases 2–8:** Complete flows, secure APIs, nutrition services, PostgreSQL, intelligence, Kernel integration and production certification are future work.

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
  ui/             application shell, dashboard and shared design language
docs/
  ARCHITECTURE_RECONCILIATION.md
  PHASE_DELIVERY.md
.github/workflows/
  ci.yml          type-check, test and bundle
  pages.yml       publish static preview from main
```

## Governance
Do not treat dashboard scores as actual clinical states. Missing meal logs are incomplete observations, not observed absence of intake. Family-only shared logistics are surfaced separately from sensitive individual health state. Integrations, authentication, AI calls and persistence are not implemented in Phases 0–1.
