# Nutrition OS — Phase 6 Frontend–Backend Integration

## Delivery statement
Phase 6 introduces a premium **authenticated React workspace** using the Phase 5/6 REST APIs and PostgreSQL as the source of truth. The original frontend mock remains a **separate** sample-only preview. The two modes never copy, synchronize or silently mix their records.

## Live routing and activation
- Local Vite uses mode=live by default. A visible sign-in prompt accepts a locally signed short-lived development JWT only when Vite is running on localhost/127.0.0.1 in development mode.
- A static GitHub Pages build stays in labeled preview mode by default. In nonlocal builds, live token-pasting is disabled: a real Personal Kernel identity provider is required to unlock production.
- Tokens are held only in React memory; never localStorage, cookies, URL or source files. Cross-origin HTTP is forbidden except localhost.
- Vite proxies same-origin /api to the local backend port 3001; the token is sent only to that configured API, never an external helper service.
- API errors or expired sessions are shown explicitly. No sample records appear as a fallback in the authenticated experience.
- API writes include client-generated idempotency keys; post-commit refreshes display server-confirmed state.

## Live screens / authoritative contracts
1. Dashboard: signed session, observed meal/state, hydration, plans, groceries, inventory, budget and progress. No fabricated scores.
2. Profile/onboarding: full profile, preferences, user-defined targets, saved via PUT /profile.
3. Nutrition goals: GET/POST /goals with explicit dates and user-entered values; no clinical prescriptions.
4. Foods: CRUD via GET/POST/PUT/DELETE /foods; revision guard, soft-retire, unverified provenance.
5. Recipes: CRUD with owner food references, ingredient servings, revision conflict and approved-plan edit protection.
6. Today/meals: explicit confirmed consumption, logged food snapshots, optimistic correction by expectedRevision, soft delete.
7. Hydration: GET/PUT /hydration; absence is unknown, not zero.
8. Progress: GET /progress, 90-day bounded actual observation dates only, no synthetic days.
9. Weekly planner: new plan, add/remove and lock entries, approve/reopen. Planned meals never auto-log intake.
10. Groceries: approved-plan generation or manual active list, editable unchecked quantities, purchase checks, optional explicitly entered paid amounts, separate inventory receipts and preserved archive.
11. Inventory: lot creation, stock ledger, adjustments, waste/expiry events and location transfers.
12. Food budget: KES allocation versus manually reported costs, no real financial transactions.
13. Waste: balances and expiry dates, explicit disposal, no fabricated waste efficiency.
14. Insights: explainable observed facts, missing-data boundaries and a rule-based local Nutrition Guide; no live LLM, clinical diagnosis or autonomous mutation.
15. Family: owner-created shared kitchen, UUID-scoped pending invites, acceptance by the invited signed subject, owner/editor/viewer roles and sanitized plans/tasks/groceries; no other member's personal intake, goals, health or paid amount.
16. Privacy and integrations: true session identity and honest external-connection status. Kernel consent/identity and Finance/Health/Fitness/Calendar integrations are future phases.

## Database and identity
Migration 004 adds soft-retirement/revision fields, persistent hydration, active/archived grocery lists, and a scoped household kitchen model with row-level security. Verified tenant/user claims (never X-User-ID headers) are set with SET LOCAL for each DB transaction. Shared-kitchen role checks are SECURITY INVOKER and respect PostgreSQL RLS.

Signed members are required to accept an invitation before viewing the shared board. Only the owner may publish a sanitized approved plan. Editors can coordinate shared groceries and meal tasks; viewers cannot mutate data. This is Nutrition OS kitchen coordination, **not Family OS authoritative relationship or consent management**.

## Development usage
Use Node 22+ and Docker Compose. From the repository root:

1. docker compose -f docker-compose.backend.yml up -d
2. npm install
3. npm --prefix server install
4. cp server/.env.example server/.env
5. Set a new local signing secret and local DB parameters; do not reuse the example passwords in a production deployment.
6. npm --prefix server run db:migrate
7. npm --prefix server run dev (API on 127.0.0.1:3001)
8. In a different terminal: npm --prefix server run dev:token
9. npm run dev (Vite on localhost:5173)
10. Open http://localhost:5173/?mode=live and paste the development token only into the local sign-in form.

To inspect the former sample screens without authenticated data, visit http://localhost:5173/?mode=preview. Do not present demo progress as real personal nutrition.

## Verification
GitHub Actions provisions PostgreSQL, runs migrations 001–004 with restricted HTTP role, then compiles and tests both frontend and backend. Database integration tests exercise real signed token claims, profile/meal/hydration, food and recipe revisions, stock/grocery flows, household invitation acceptance, cross-user and cross-tenant isolation, viewer/editor restrictions and event outbox integrity.

CI does not establish a passing interactive browser accessibility or device test. Production Kernel OIDC, consent federation, broker delivery, verified food reference data, disaster recovery and operational security certification are not part of Phase 6.

## Next gates
Phase 7: canonical Personal Kernel identity and consent; Family OS membership/rights reconciliation; secure event and Finance/Fitness/Calendar/Health projections. Phase 8: browser E2E, independent security review, performance/backup/restore, production infrastructure and safety certification.
