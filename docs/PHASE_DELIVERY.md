# Nutrition OS — Phase delivery & acceptance

## Phase 0 (this change)
- [x] Inspect the target GitHub repository and confirm its actual baseline.
- [x] Establish clean frontend source, types, package scripts, docs, CI, Pages workflow.
- [x] Validate dependency install, TypeScript check, unit tests and production bundle in GitHub Actions (run 41174671644, passed).
- [ ] Confirm Pages is enabled and publicly live (requires successful Pages run).

## Phase 1 (this change)
- Premium desktop and responsive application shell, visual tokens, typography.
- Personal Nutrition Command Center: daily status, energy, protein, hydration, meal timeline, nutrient breakdown, goal progress, AI-guide preview, weekly review, household grocery preview and family privacy-safe summary.
- Functional sample-only actions: nutrient tabs, local meal logging, water adjustment, grocery checkoff, suggestion cycling, date navigation, search, personal/family view switch and explanatory preview panels.
- Clear demo labelling, nutrition uncertainty, and pending-module boundaries.
- No fake authentication, fake clinical diagnoses, fake live AI or fake server persistence.

## Phase 2 onward
2. Onboarding, Today, Meals, foods/recipes, goals, progress.
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
