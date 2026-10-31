# Nutrition OS — Phase 7 HumanKernelOS Integration Boundary

## Status
A working, independently testable, fail-closed **engine-side integration** is implemented.
Full live HumanKernelOS ↔ Nutrition OS interoperability is **NOT YET CERTIFIED**: the inspected HOS repository does not yet offer a public cross-service identity-token exchange, signed external engine ingress or a live External Event Mesh HTTP contract.

## Repository reconciliation (2026-10-31)
- HumanKernelOS docs CANONICAL_ARCHITECTURE.md and DOMAIN_OWNERSHIP.md establish HOS authority over human identity, consent, engine lifecycle, Human State and the single Daily Operating Plan.
- HOS src/lib/sdk/index.ts has a server-only Engine SDK. Its executable adapters run inside the process and its persisted engine registry is lifecycle authority. The public platform API currently exposes a health probe, not external engine installation or signed event ingress.
- HOS src/lib/nutrition.functions.ts is still an **internal legacy nutrition producer** writing nutrition_logs and MealLogged and derived engine_signals. It must be reconciled/migrated before external Nutrition OS becomes the single canonical nutrition authority. Do NOT import these historical records without explicit user review, deduplication and provenance.
- HOS authentication currently uses Supabase sessions and no verified cross-service Nutrition user JWT exchange.
- Family-Os is presently a frontend prototype without a certified authoritative membership event endpoint; Finance-Os has a separate backend, but its financial ledger must never be directly queried or mutated by Nutrition OS.
- All external data must move via an installed and authorized Kernel-mediated engine capability/event, never by direct cross-repository databases.

## Delivered engine-side backend
- PostgreSQL migration 005: tenant/user FORCE RLS for signed Kernel engine binding, individually granted scopes, short-lived scalar context projections, Family OS membership attestations and Daily Operating Plan proposal ledger. Zero seed grants.
- Dedicated **machine service** JWT trust, separate from user identity JWTs: RS256/ES256, signed sub and tenant_id UUIDs, fixed client_id, required service scope, specific bridge audience+issuer, 5-minute maximum token lifetime, JWKS verification.
- POST /api/v1/nutrition/kernel/authority accepts only signed lifecycle+consent assertions. Lease is no more than 24h, assertions must be recent, disabled/suspended engines cannot carry active grants, old signed assertions cannot restore revoked consent.
- POST /api/v1/nutrition/kernel/events accepts only a signed bridge token and six strict versioned inbound event contracts. Transactional event_inbox guarantees duplicate replay does not create duplicate effects.
- GET /api/v1/nutrition/kernel/status returns scoped lifecycle, current grants and an explicit flag showing transport NOT certified/live. GET /kernel/context returns only nonexpired, consented projections. GET /kernel/proposals returns the owner's own proposal ledger.
- POST /kernel/proposals requires approved own meal plan, current engine lifecycle, the nutrition.schedule.propose grant and a bounded meal/grocery time window. Status starts proposed and does NOT modify Kernel Daily Operating Plan. Only signed kernel.plan.decision can move it to accepted/rejected; revocation cancels pending proposals.
- Family RLS in production requires both a locally accepted invitation AND a current matching signed family.membership.attested assertion for the signed subject, role and household. Wrong role, expired assertions, or revoked consent hide shared boards and prevent changes. The owner retains their own household workspace.
- Privacy-filtered outbound projector converts only recent post-consent events to versioned minimal HOS envelopes. It sends aggregate logged observations, explicitly recorded hydration, or schedule intents, without meal narratives, recipe/food IDs, individual family metrics, financial transactions or health records. No real outbound transport has been activated without a verified HOS Event Mesh ingress.

## Seven independent Kernel consent scopes
nutrition.signal.publish
nutrition.schedule.propose
nutrition.context.fitness
nutrition.context.finance
nutrition.context.calendar
nutrition.context.health
nutrition.context.family

All are denied absent a valid signed HOS lifecycle binding and explicit grant. The Nutrition frontend has no self-approval control.

## Six inbound minimal event types (schema version 1)
- fitness.workout.completed: durationMinutes integer, 0–600; no raw workout/health notes.
- finance.food_budget.headroom_changed: headroomKes bounded numeric and currency KES; no bank transactions, account details or postings.
- calendar.nutrition_window.changed: YYYY-MM-DD date, startTime and endTime; no global calendar mutation.
- health.nutrition_safety.changed: clinicalReviewRequired boolean only; no diagnoses, medications, protected clinical text. True gates the Nutrition Guide's advice.
- family.membership.attested: accepted local household ID, role, active flag, expiry; only the actual signed member receives access.
- kernel.plan.decision: own proposal ID, decision ID and accepted/rejected state.

Any unknown event type, payload field, missing scope, replayed event ID, stale timestamp, wrong audience/issuer or untrusted user token is rejected. Event projections have bounded TTLs; absence is not converted into negative health conclusions.

## Outbound events (schema version 1)
nutrition.observed_meals_changed.v1
nutrition.hydration_observed.v1
nutrition.schedule_proposed.v1

The outbound producer is an injectable, **consent-checked projector only**. It has no configured live Event Mesh transport. Normal outbox local stdout remains a test sink and must not be represented as production delivery.

## JWT trust separation
Ordinary Nutrition user JWTs must be verified against the Personal Kernel-approved user issuer/JWKS, audience nutrition-os-api. The additional machine bridge JWT must use KERNEL_BRIDGE_JWKS_URL, KERNEL_BRIDGE_ISSUER, KERNEL_BRIDGE_AUDIENCE and distinct scopes nutrition:kernel:govern and nutrition:kernel:event.
Production requires HTTPS for remote JWKS. The API uses bearer tokens with verified subject, tenant and scopes; headers or request bodies cannot choose another person.
No credentials, HOS signing keys, raw patient records or private family details may be put in the static frontend, environment VITE variables, examples or event payloads.

## User-facing experience
The existing authenticated Integrations screen now displays actual API-reported lifecycle, consent grants and expiry, authorized external context and Kernel decision history. Unapproved actions are disabled. The plan proposal form is never represented as a final schedule. The Health review flag blocks deterministic Nutrition Guide meal advice.
The sample GitHub Pages preview remains separate and cannot issue privileged Kernel requests.

## Local verification
Start PostgreSQL, install dependencies, run migration 005, and start Nutrition backend/frontend as in Phase 6.
To test the external bridge without HOS deployment, CI spins up an **ephemeral local RS256 JWKS service** and signs short-lived service assertions; it verifies lifecycle, scope expiration and revocation, tenant/user RLS, family access, provenance/TTL, inbox deduplication, schedule acceptance authority and outbound privacy envelopes against PostgreSQL.
This test issuer is for CI only. It is never a production identity substitute.

## Mandatory work in HumanKernelOS and other engines before live sign-off
1. Publish a genuine Kernel-managed authenticated JWT exchange and JWKS for external user sessions, including verified tenant mapping, short-lived expiry, scopes and revocation. Do not treat existing Supabase JWTs as equivalent without verification.
2. Install nutrition-os as an **external independent engine** via persisted HOS engine registry, not by adding a static catalogue row. Register its manifest, capability versions, Event Mesh schemas and subscriptions through the generic SDK; verify enabled/disabled lifecycle.
3. Expose a signed Kernel service bridge with separate JWKS/issuer/audience. It must inspect canonical engine_permissions and lifecycle before asserting and routing each subject's consent and each external provider event.
4. Build an authenticated HOS external Event Mesh ingress for three outbound Nutrition event types, with stable event ID dedupe, schema registry, audit, bounded retry/dead letter and consumer consent checks. Then deploy a genuinely authorized, least-privilege Nutrition outbound publisher; no test stdout substitute.
5. Reconcile the existing internal HOS nutrition_logs, MealLogged and engine_signals through an audited and user-approved migration/retirement, with no double-authoritative records.
6. Replace local provisional family membership with a real Family OS authoritative membership and revocation provider, passed only through HOS; certify consent for minors and dependent records.
7. Add genuine HOS-mediated Finance/Fitness/Calendar/Health provider connections; do not read their private tables.
8. End-to-end staging certification: install → authorize → signed inbound signals → Nutrition read model → authorized outbound signals/proposals → HOS decisions → revoke/disable → verify complete denial and recovery.

## Phase status
**Phase 7 engine-side security and API contracts: implemented and CI-verifiable.**
**Phase 7 real external HOS installation, identity exchange, event delivery and provider integration: blocked by missing HOS-side services, not claimed complete.**
Phase 8 production readiness must separately cover production identity, real deployment, backups/recovery, incident response, load testing, E2E browser testing, privacy and accessibility.
