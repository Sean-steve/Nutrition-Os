# Nutrition OS — Phase delivery & acceptance

## Phase 0 (this change)
- [x] Inspect the target GitHub repository and confirm its actual baseline.
- [x] Establish clean frontend source, types, package scripts, docs, CI, Pages workflow.
- [x] Validate dependency install, TypeScript check, unit tests and production bundle in GitHub Actions (run 41174671644, passed).
- [ ] **DEPLOYMENT BLOCKER:** GitHub Pages is not enabled and the GitHub Actions token cannot create a site (403). Repository owner must select **Settings → Pages → Source: GitHub Actions** then rerun the Pages workflow. Build succeeds. See deployment issue.

## Phase 1 (this change)
- Premium desktop and responsive application shell, visual tokens, typography.
- Personal Nutrition Command Center: daily status, energy, protein, hydration, meal timeline, nutrient breakdown, goal progress, AI-guide preview, weekly review, household grocery preview and family privacy-safe summary.
- Functional sample-only actions: nutrient tabs, local meal logging, water adjustment, grocery checkoff, suggestion cycling, date navigation, search, personal/family view switch and explanatory preview panels.
- Clear demo labelling, nutrition uncertainty, and pending-module boundaries.
- No fake authentication, fake clinical diagnoses, fake live AI or fake server persistence.

## Phase 2 — implemented on feature branch
- Three-step onboarding, profile preferences, Today timeline, meal corrections/deletion, expanded food search and portion logging, recipe studio, editable goals, observed-date progress.
- Frontend-only state; these operations are explicitly labeled as sample interactions and are not persisted.
- See `PHASE_2_DELIVERY.md`.

## Phase 3 — interactive resource preview
- Weekly plan draft, approved, locked, edited, and grocery generation from recipe requirements.
- Inventory pantry/fridge/freezer ledger, grocery receipts, budget and waste/expiry tracking.
- See `PHASE_3_DELIVERY.md`.

## Phase 4 onward
3. Meal planner, grocery, inventory, budgets, waste.
4. Recommendations, AI experience, insights, family logistics.
5. Real database/domain services/REST/events.
6. Complete front-to-back workflows.
7. Personal Kernel identity, consent and integrations.
8. Full tests, safety, privacy and production certification.

## Phase 1 acceptance
- `npm run check` passes.
- `npm run test` passes.
- `npm run build` produces `dist`.
- App loads from a static subpath such as `/Nutrition-Os/`.
- No controls advertised as live beyond local demo behavior.
- Keyboard focus, status labels, small screen reflow, and screen-reader labels.

## Phase 4 -- frontend prototype
- Observed-only explainable nutrition insights with feedback and limitations.
- Rule-based read-only assistant with safety responses, tool boundaries and no LLM connection.
- Family Nutrition Command Center: shared plans, kitchen assignments, groceries, household budget and privacy-safe demo roles.
- See `PHASE_4_DELIVERY.md`.

## Phase 5 — PostgreSQL and REST API foundation
- Fastify TypeScript server, PostgreSQL schema/migrations and restricted RLS-backed application role.
- Scoped APIs for verified food records (user unverified by default), recipes, goals, meal snapshots, plans, groceries, pantry ledger and sample food budgets.
- Transactional event outbox, minimal audit, request idempotency and leased test-sink dispatcher.
- Frontend continues as a sample-only preview; integration occurs in Phase 6.
- Documentation: `PHASE_5_DELIVERY.md`, `PHASE_5_API_CONTRACT.md`.

## Phase 6 — Authenticated frontend/backend integration
- Distinct API-connected premium workspace for personal nutrition, planning, resources, explainable insights and private-by-default family kitchen sharing.
- PostgreSQL migration 004 for hydration, revisions, grocery list status and RLS-secured shared kitchen tables.
- Only user-entered observations appear in signed-in state; no synthetic personal data is imported or used on errors.
- The original Pages experience remains an explicitly labeled demo, with no live API claims.
- See PHASE_6_DELIVERY.md and PHASE_6_API_ADDENDUM.md for workflows, identities, limitations and local setup.

## Phase 7 — HumanKernelOS external-engine contract and governance
- Migration 005: consent/lifecycle binding, minimal inbound projection cache, signed Family OS membership attestation and Kernel-only schedule decision state, all subject/tenant RLS.
- Distinct RS256/ES256 short-lived service identity; signed HOS authority and strict inbound event APIs. Legacy local nutrition user JWTs cannot enable engine lifecycle or consent.
- Projections, permissions and status exposed to a premium authenticated integration view. Unverified external context is not fabricated. Observed-only outbound envelope projector and pending schedule intents are implemented without claiming a real Event Mesh transport.
- Automated real PostgreSQL and ephemeral RS256 JWKS tests check wrong audience, stale grant, scope gating, inbox duplicates, cross-user isolation, family revocation, schedule decisions and payload minimization.
- Full HOS installation, real OIDC/JWKS exchange, HOS outbound event receipt, Family OS source of truth and cross-engine deployments remain explicit blockers. See PHASE_7_KERNEL_INTEGRATION.md.

## Phase 8 — Code quality / operations hardening and mandatory release gate
- Production API startup safety checks, privacy headers and authenticated/schema-aware readiness.
- PostgreSQL CI dump/restore drill including audit/outbox counts and FORCE RLS.
- Security/performance concurrency test suite; desktop/mobile Playwright and axe accessibility smoke.
- Runtime dependency HIGH-severity audit. Machine-readable 18-gate evidence matrix and runbook.
- Real HumanKernelOS/FAMILY OS, clinical/privacy, production infrastructure and disaster recovery certification remain blocked. NOT READY is the honest verdict.
- Docs: PHASE_8_CERTIFICATION.md, PHASE_8_OPERATIONS_RUNBOOK.md, PHASE_8_RELEASE_EVIDENCE.json.
