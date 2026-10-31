# Nutrition OS

Personal and family nutrition intelligence and execution engine within the Human Kernel ecosystem.

## Current delivery

- **Phase 0:** completed repository reconnaissance and architectural baseline.
- **Phase 1:** premium responsive dashboard shell implemented with the approved visual direction.
- **Mode:** frontend-only design preview with clearly disclosed **illustrative** data; no clinical claims, live records, API or AI provider.

### Run locally
No dependency installation or build is required.

```bash
python3 -m http.server 4173
```

Open http://localhost:4173 . The site also supports GitHub Pages from the repository root.

### Dashboard behaviors
The dashboard includes responsive sidebar, searchable sample meals/foods, date navigation, nutrient category switching, grocery/inventory switching, local grocery checklist, recommendation alternatives, example meal details, a constrained preview guide, and an explicit roadmap state for future screens. No sample content is silently presented as real user data.

### Project documentation
See [Architecture baseline](docs/ARCHITECTURE_BASELINE.md) and [Phase acceptance](docs/PHASE_0_1_ACCEPTANCE.md).

### Delivery roadmap
Phase 2: onboarding, profile, today, meals, food and recipe management, goals and progress.  
Phase 3: meal planning, groceries, inventory and food waste.  
Phase 4: intelligence, insights and family.  
Phase 5+: backend, database, integrations, security, end-to-end validation.

### Deployment
GitHub Pages can serve this static application from `main` root after enabling **Settings → Pages → Deploy from a branch → main / root**. Branch `feat/phase-0-1-dashboard` is the review branch until merged. No deployment is implied until Pages is enabled and verified.
