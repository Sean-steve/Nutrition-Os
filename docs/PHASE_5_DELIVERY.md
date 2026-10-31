# Nutrition OS Phase 5 — Backend & Data Foundation

## Status and trust boundaries
This phase introduces a separately installable Fastify/TypeScript API under server/, PostgreSQL 16 migrations, subject/tenant RLS, domain services, transactional event outbox and integration tests. **The Phase 0–4 frontend is intentionally still an in-memory demonstration**. Connecting live UI actions to these APIs is Phase 6, not a Phase 5 claim.

Nutrition OS owns food composition records (as user-entered, UNVERIFIED by default), recipe ingredients, logged meal snapshots, plans, grocery needs, inventory ledger and sample food-budget planning. It does **not** own Personal Kernel global identity, clinical notes, payment transactions or household member authority. No cross-engine integrations or production Kernel connection exist yet.

## Local setup
Prerequisites: Node 22+, Docker Engine with compose. Use local-only credentials; do not reuse the illustrative passwords outside a laptop.

1. Start PostgreSQL:
   docker compose -f docker-compose.backend.yml up -d
2. Install frontend and backend dependencies:
   npm install
   npm --prefix server install
3. Copy server/.env.example to server/.env. Use fresh local secrets and update URLs to match them. The migration role must be privileged, the API role must NOT have SUPERUSER/BYPASSRLS.
4. Apply migrations and create local-only restricted API role (never enable this bootstrap in production):
   npm --prefix server run db:migrate
5. Launch HTTP API:
   npm --prefix server run dev
6. Create a signed development-only token:
   npm --prefix server run dev:token
   Set USER_ID and TENANT_ID to UUIDs if needed. Tokens expire after one hour.
7. Verify:
   curl http://127.0.0.1:3001/health/live
   curl http://127.0.0.1:3001/health/ready
8. Example authenticated request (do not embed a dev token in the GitHub Pages frontend):
   curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3001/api/v1/nutrition/foods

All write requests must carry an **Idempotency-Key** with 8–120 alphanumeric/dot/underscore/hyphen characters. Same key+method+path+identical payload returns the stored response. Reuse with different payload is a conflict.

## API prefix /api/v1/nutrition
### Personal, knowledge and meal services
- GET/PUT /profile — owner profile/prefs/explicit example targets.
- GET /foods?q=, GET /foods/:id, POST /foods — scoped food catalogue. POST always unverified.
- GET /recipes, POST /recipes — ingredient-based owner-scoped recipe creation.
- GET /goals, POST /goals — user-editable goals, **not medical prescriptions**.
- GET /meals?date=YYYY-MM-DD, GET /meals/:id, POST /meals — explicit observed meals.
- PUT /meals/:id — correction (requires expectedRevision); DELETE /meals/:id — soft delete.
- GET /state?date=YYYY-MM-DD — only logged intake, or intake:null with observationStatus:unknown.
- GET /insights?date=... — observation-only provenance/limitations, no AI or diagnosis.

### Plans and household resource planning
- GET /plans?weekStart=YYYY-MM-DD, POST /plans — Monday-based weekly plan.
- POST /plans/:id/entries, DELETE /plans/:id/entries/:entryId, PATCH /plans/:id/entries/:entryId/lock.
- POST /plans/:id/approve, POST /plans/:id/reopen — explicit state machine; no automatic consumption.
- GET /inventory, POST /inventory/lots, POST /inventory/movements, POST /inventory/transfers.
- GET /groceries, POST /groceries/generate — requires approved plan; subtracts only lots whose entered expiry covers the planning horizon; accepts user-supplied illustrative unitPricesKes keyed by food UUID. Blocks regeneration with unreceived purchases.
- PUT /groceries/lines/:id/purchase — checkoff and optional actualPaidKes; does NOT add inventory.
- POST /groceries/lines/:id/receive — explicit receipt; creates lot+movement once.
- GET/PUT /budget — planning KES allocation and separately recorded actual amounts. **Not Finance OS transactions**.

### Health and availability
- GET /health/live — process status.
- GET /health/ready — DB reachable (not full cross-engine certification).

## Events, audit, idempotency
Every successful mutation writes an audit event and schema-versioned event_outbox row in the same database transaction as domain tables; only IDs, state codes and bounded metadata belong in event payloads. The HTTP role cannot read the outbox or audit ledger. The local event worker leases outbox rows with SKIP LOCKED, publishes minimal envelopes to a **local stdout test sink only**, and acknowledges/retries with exponential delay. This is **not a production broker integration**. Inbox deduplication table is provisioned for future Personal Kernel event bridge (Phase 7).

## Identity and security
The API authenticates only signed JWT bearer tokens and uses verified sub+tenant_id as transaction-local RLS context. Authorization requires nutrition:read or relevant nutrition:<domain>:write (nutrition:write grants write in local testing). Request-supplied x-user-id/x-tenant-id headers have no authority. Local HMAC tokens require LOCAL_IDENTITY_ENABLED=true and refuse production mode. Production requires KERNEL_JWKS_URL, KERNEL_ISSUER and KERNEL_AUDIENCE, plus actual Kernel authorization/consent certification in later phases. Database connections for HTTP must never use the migrator or event-worker role.

## Durable facts vs estimates
Meals store nutrient snapshots at log time with food source/provenance; editing a food catalogue entry in the future must not silently rewrite historical meals. Planned meals do not count toward intake. Missing logs mean **unknown**, not zero. Pantry balances arise only from append-only movements, and a DB trigger rejects negative balances even under concurrent requests. Food quantities use user-defined servings; verified composition and units data are later work. No family member's individual nutrition/health data is exposed through Phase 5 routes.

## CI certification
GitHub Actions provisions PostgreSQL 16, migrates using privileged connection, grants only restricted role privileges for HTTP, then runs frontend and backend TypeScript, unit tests, production build, and real HTTP+database integration tests covering JWT scopes, RLS isolation, idempotency, outbox, nonnegative stock, meal corrections and grocery receipt exactly-once semantics.

## Explicit follow-up
Phase 6: frontend adapter contracts, real login flow, backend persistence integration, cross-module UX and family shared resource authority. Phase 7: Kernel OIDC/JWKS + consent/household permissions and genuine event transport. Phase 8: full safety, load, threat-model, disaster recovery and production certification. GitHub Pages remains a static frontend; it does **not** host this Node/PostgreSQL API.

### Additional database isolation hardening
Migration 003 adds composite (tenant_id,user_id,id) foreign-key constraints so a child row cannot refer to another actor's food, recipe, plan, meal or stock lot even if a future service omits a check. CI verifies cross-owner FK rejection and the local leased event-outbox dispatch/ack flow.
