# NUT-OS-RECON — Repository reconciliation (Phase 0)

## Observed state (2026-10-31)
The connected GitHub repository `Sean-steve/Nutrition-Os` existed as a public, empty repository, with default branch `main`. The GitHub API returned 404 for repository contents ("This repository is empty") and 409 for the main Git reference. No application code, schemas, tests, pipelines, or deployment existed. An initial README commit established `main`. No legacy work was overwritten.

## Canonical source material
The previously produced Nutrition OS engineering volumes:
NUT-000 System Architecture; NUT-DOM-001 Domain Model; NUT-SVC-001 Service Architecture; NUT-API-001 API & Event Contracts; NUT-DAT-001 Data & Persistence; NUT-INT-001 Intelligence & Decision; NUT-SEC-001 Security/Privacy/Safety/Governance; NUT-UX-001 UX & Family Command Center.

## Intended product boundaries
Nutrition OS is the authority for food records, meals, recipe calculations, requirements, nutrition state, personal planning, nutrition recommendations, household resource planning, and outcome feedback. It does NOT own global Kernel identity, medical records, financial transactions, workout history, or family relationship authority. Integrations must be consent-scoped contracts, not shared databases.

## Technology decisions (Phase 0–1)
- React 19 + TypeScript + Vite for the initial frontend.
- Modular frontend with domain calculations independent of UI, typed sample fixtures and replaceable data adapter seam.
- CSS design tokens and responsive, accessible components.
- Hash-route navigation for static GitHub Pages compatibility.
- GitHub Actions CI for typecheck, tests, build; deploy frontend using Actions Pages on `main`.
- No API, database, AI model, photo recognition or Kernel connection in these phases.
- No implicit assertion that prototype metrics, suggested meals, members, or budgets belong to the user.

## Gap classification after Phase 1
| Capability | State | Next |
| --- | --- | --- |
| Repository, app build, design tokens, shell | Implemented (subject to CI verification) | Maintain |
| Personal dashboard using sample fixtures | Implemented (subject to CI verification) | Wire real state in backend integration |
| Dashboard interactions | Sample/local-only | Phase 2+ |
| Today/meal logging/recipes/goals | Planned | Phase 2 |
| Meal plan/groceries/inventory/budget/waste | Planned | Phase 3 |
| AI intelligence, recommendations, family flows | Planned | Phase 4 |
| Nutrition domain, DB, APIs, outbox, calculations | Missing | Phase 5 |
| Secure identity, tenant isolation, consent | Missing | Phases 5–7 |
| Kernel/Fitness/Finance/Calendar/Health integrations | Missing | Phase 7 |
| Production safety/clinical guardrails | Missing | Phases 5–8 |
| Full E2E certification and production rollout | Missing | Phase 8 |

## Non-negotiable implementation rules
1. Do not present illustrative state as actual dietary or health information.
2. Logged intake is an estimate, not a clinical diagnosis; missing food logs are unknown intake, not zero.
3. Photo recognition cannot silently confirm portions.
4. No autonomous medical decisions, and no shared family member health metrics without consent.
5. Integrations only receive minimal authorized claims.
6. Every later phase must preserve the premium UI visual foundation.
