# Nutrition OS — Phase 0 Repository Foundation & Architecture Reconciliation

Date: 2026-10-31

## Verified baseline
- Repository: `Sean-steve/Nutrition-Os`.
- Default branch: `main`.
- At discovery, the only tracked file was a 324-byte README.
- No frontend source, package manifest, tests, backend, migrations, CI/CD, auth, or event delivery subsystem was present.
- The README already stated a Phase 0/1 preview intent. There is no existing system to migrate or replace.

## Canonical architecture
Nutrition OS owns personal nutrition knowledge, intake, nutrition calculations, planning, inventory and nutrition intelligence; Human Kernel owns cross-domain identity, policy, consent, global orchestration and engine registry. Finance, Health, Fitness and Family OS remain authoritative over their respective domains. No direct cross-engine database calls.

Domain boundaries: Food Knowledge; Person Nutrition; Meal/Recipe; Planning; Resources; Nutrition State; Intelligence; Outcome/Learning.

Data design target: PostgreSQL source of truth, Redis optional ephemeral state, object storage for user media, outbox/inbox event infrastructure. Nothing in Phase 1 claims these are implemented.

## Architectural decisions
1. Frontend-first development as requested. Phase 1 uses dependency-free HTML/CSS/JS to allow rapid Pages preview; the project can migrate to a component framework when broader multi-screen interactions justify it.
2. No fabricated authenticated user, actual health conclusions, or persistence. All sample values are labeled.
3. No hardcoded sample content presented as production data; sample models are isolated to `assets/app.js` and must be removed/replaced during real API integration.
4. Privacy: family examples are role-neutral and do not show members' private personal nutrition metrics.
5. Deterministic authoritative calculations, provenance, strong authorization/consent and Kernel integrations are deferred to backend phases, never simulated as working.

## Feature classification at Phase 1
| Capability | State |
|---|---|
| Repository baseline and architecture reconciliation | COMPLETE |
| Dashboard visual shell | COMPLETE |
| Responsive desktop/mobile layouts | IMPLEMENTED — browser visual QA pending |
| Dashboard demo controls | IMPLEMENTED — browser interaction QA pending |
| Onboarding and remaining screens | MISSING (Phases 2–4) |
| Real nutrient calculations | MISSING |
| Backend/domain APIs/database | MISSING |
| Kernel integrations | MISSING |
| Security/consent enforcement | MISSING |
| Production-grade tests and accessibility audit | MISSING |

## Non-negotiable handoff constraints
Implement remaining screens in the Phase 1 design language. Use only user-approved scope and sample-data boundaries. Real production data must be persisted via authorized domain APIs, not in local JS state. No AI autonomous health guidance without safety governance. The personal dashboard is not a clinical diagnosis interface.
