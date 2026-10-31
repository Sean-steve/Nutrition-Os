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
