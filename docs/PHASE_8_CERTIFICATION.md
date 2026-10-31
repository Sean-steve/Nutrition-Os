# Nutrition OS — Phase 8 Certification and Release Readiness

Date: 31 October 2026. Scope: Nutrition-Os repository code, local PostgreSQL API and browser workflows. This is a CI-based engineering assessment, NOT a certification that a public, multi-service production environment exists.

## Decision: NOT READY FOR PRODUCTION

The authoritative machine-readable gate input is docs/PHASE_8_RELEASE_EVIDENCE.json. The independent readiness check in scripts/release-gate.mjs supports --require-ready, which exits nonzero until all required gates have reviewable evidence. A code merge never substitutes for approval of absent live services, clinical safety or privacy compliance.

## Phase 8 engineering controls

### Production boundary hardening
- Fail-closed production startup checks: refuse local identity, missing user or distinct machine Kernel JWKS, HTTP remote trust sources, invalid CORS origins, development sample database secrets and privileged migrator credentials in the API process.
- API privacy headers: no-store, nosniff, anti-framing, no-referrer, restrictive CSP and Permissions Policy. TLS termination must additionally enforce transport security.
- Database-aware readiness health check requires representative migration 001–005 schema objects. It does not expose credentials or require privileged migration-history reads.
- Safe 400/413/415/429 HTTP errors, never raw database or credential traces.
- Existing verified JWT subject/scopes, PostgreSQL FORCE RLS, optimistic revisions, idempotency, consent expiry and Family attestation controls remain enforced.

### Database / contract / security tests
- Existing personal/household/Kernel database integration tests plus Phase 8 header, input validation, SQL-injection-shaped query, forged identity, oversized body and concurrency smoke tests.
- Test batch: 12 identical simultaneous idempotent writes must result in one committed food; 60 mixed authenticated reads must satisfy an intentionally loose local CI p95 guard. This is not a representative production load test.
- Frontend and backend production dependencies are audited for HIGH/CRITICAL advisories within CI; independent SAST, container scanning and penetration testing remain separate gates.

### Disposable database recovery drill
- The backup-restore-ci.sh script performs a custom PostgreSQL dump, restores into an isolated disposable test database, compares ten representative domain/audit/outbox table counts, checks all five migration records, and verifies FORCE RLS on three sensitive tables.
- Refuses execution outside CI NODE_ENV=test. Only known disposable CI restore DB can be dropped.
- This proves CI restoration correctness on a test database. It does not prove production backup encryption, PITR, retention, offsite replication, a target recovery time or a target recovery point.

### Browser / UX / accessibility certification
- Desktop and mobile Playwright Chromium exercises the actual Vite live UI and a local PostgreSQL-backed API.
- Scenarios: demo vs authenticated separation, signed-in empty state, actual user-record visibility, default-denied Kernel permissions, failure without sample fallback and viewport safety.
- Automated axe WCAG A/AA scan checks serious/critical violations on sign-in; keyboard focus is smoke tested.
- Limits: this is not comprehensive manual screen-reader testing, all-screen visual regression, actual professional clinical review or multi-service production staging E2E.

### Kernel and product authority
- HumanKernelOS is identity/consent, Human State and final Daily Operating Plan authority. Nutrition OS owns its own nutrition data, with minimal consented projections only.
- The HOS production identity exchange, external engine registry installation, live authorized Event Mesh transport, authoritative Family OS membership and reconciliation of the legacy internal HOS Nutrition Engine are still absent from the verified live environment.
- External contracts are real repository code but are not a claim of functioning deployed cross-service integration. Do not bypass them using local developer tokens or a shared database.

## Release gate matrix

| Gate | Current status | Required evidence |
| --- | --- | --- |
| TypeScript/unit/build and PostgreSQL contract suites | Automated repository checks | Passing final main CI |
| Security/tenant/RLS and dependency review | Automated controls, independent review pending | Security assessment and CI |
| Desktop/mobile browser and accessibility | Automated checks, manual review pending | Browser traces plus WCAG audit |
| Ephemeral PostgreSQL restore | CI drill | Final CI proof |
| Performance/reliability | Local CI smoke | Staging load, chaos, p95/SLO evidence |
| HOS identity + engine install + Event Mesh | BLOCKED | Working live cross-service test |
| Family authoritative membership/revocation | BLOCKED | Live Family OS test |
| Medical/diet/allergen/minor safety and food provenance | BLOCKED | Reviewed safety case |
| DPIA, consent, retention, export/deletion | BLOCKED | Reviewed privacy case |
| API, Postgres, secrets, worker, TLS and WAF | BLOCKED | Live production infrastructure |
| Production encrypted backups, PITR and recovery exercise | BLOCKED | Timed restore with agreed objectives |
| Monitoring, incident response and operational approvals | BLOCKED | SLO/alert drills and signoff |
| GitHub Pages sample preview | Check repository Pages workflow | Verified preview separately |

## Pre-release evidence and operations

Run the GitHub CI on the exact immutable main commit. Run manual browser screen-reader and responsive QA, API penetration tests, actual staging user journeys, intentionally failed network and broker delivery simulations, signed consent and Family revocation, backups/PITR and production SLO alert drills. Store redacted evidence artifacts and signoff under controlled access.

Only then update the release evidence file with independently verifiable HTTPS evidence, run the release gate with --require-ready and approve a limited rollout. Never publish real personal nutrition data in CI screenshots, artifacts, logs or a GitHub Pages sample deployment.

## Release verdict

NOT READY FOR PRODUCTION. Phase 8 repository certification can be green while real HumanKernelOS, Family OS, clinical, privacy, operational and hosting release gates remain blocked. Distinguish code-level readiness from full-system production certification.
