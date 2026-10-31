# Phase 8.1 — Production Blocker Closure & Live Staging Certification

Date: 2026-10-31. Status: **STAGING AUTOMATION PREPARED — LIVE CERTIFICATION BLOCKED**.
This is a controlled engineering staging plan, not evidence that a live Nutrition OS API, HOS OIDC exchange, Family OS provider, or clinical approvals exist.

## Preflight findings
- Main Phase 8 CI passed with TypeScript, unit/integration tests, Playwright desktop/mobile and axe A/AA automated scans, dependency audit, and a disposable PostgreSQL restore drill.
- GitHub Pages preview now deploys successfully. It is a SAMPLE-data preview, not an authenticated Nutrition OS production service.
- The connected Supabase service exposes **AGENCY OS v1** (inactive), not a dedicated Nutrition OS staging project. Do not reuse that unrelated project's database. Supabase is not automatically required for the Nutrition domain; its Phase 5 backend uses PostgreSQL directly.
- HumanKernelOS issue #5 is OPEN. HOS has a server-only Engine SDK plus an Execution OS-specific HMAC proof, but no validated Nutrition OS JWT user exchange, service-JWKS issue/registration flow or bidirectional Nutrition Event Mesh transport.
- Family OS canonical household membership/consent provider has not been proven running in staging. A local Nutrition kitchen invitation is not proof of Family OS authority.
- No dedicated staging hostname, trusted API image, secrets, encrypted backup/PITR, TLS reverse proxy, operator monitor or staging test-user credentials were exposed through the connected tooling.
- Signed-in live browser access is intentionally blocked on public websites until the canonical HOS identity flow is implemented. A public preview cannot substitute for this.

## Delivered Phase 8.1 engineering assets
1. \`infra/staging/compose.yml\`: separate private PostgreSQL network, digest-pinned image variables, nonprivileged read-only API, localhost-only API port for external TLS reverse proxy, separate migrations job. Database has **no public port**. API outbound HTTPS runs on a separate egress network (for signed Kernel JWKS retrieval).
2. \`infra/staging/init-app-role.sh\`: new-volume app login creation with NOBYPASSRLS and separate secret. \`grant-app-role.sql\` grants only required Nutrition schema permissions to the dedicated app role after migrations 001–005; audit/outbox remain append-only.
3. \`infra/staging/Dockerfile\`: build factory for isolated Node API image. Deployment requires a registry image **digest**, not a floating tag. Existing project package lockfiles are missing, so dependency builds are **not yet reproducibly pinned**. Do not claim software-supply-chain signoff until lockfiles, image base digests and SBOM/vulnerability attestations are in place.
4. \`scripts/staging/preflight.mjs\`: refuse placeholder secrets, short/shared passwords, unpinned images, privileged app DB credentials, HTTP Kernel JWKS and cross-issuer confusion. Requires chmod 0600 operator env file.
5. \`scripts/staging/certify.mjs\`: read-only HTTPS verification of deployed API+web and mandatory 401 for unsigned/forged requests. A valid Kernel-issued staging user JWT is needed to prove identity. An optional **explicit synthetic-account-only** test confirms idempotent food creation and retirement. Does not publish any personal data or credentials in evidence.
6. \`scripts/staging/*.test.mjs\` and CI checks prove offline fail-closed configuration and no fake certification. The manually dispatched \`.github/workflows/staging-certification.yml\` uses a protected \`nutrition-staging\` environment, GitHub environment variables and encrypted secrets, and certifies only basic API technical gates when real endpoints, Kernel identity and a synthetic test account exist. Clinical/privacy/go-live release gates remain separately blocked.

## Exact staging infrastructure activation procedure
**Prerequisites**: a separately authorized staging VPS/cluster, DNS, HTTPS reverse proxy, dedicated database volume, domain-validated Kernel user+bridge JWKS, distinct issuer/audience and managed keys, signed test-user tokens, repository-level staging environment/secrets and isolated synthetic tenant.

1. Build a dedicated staging API container from the exact reviewed Git commit:
   \`docker build -f infra/staging/Dockerfile -t REGISTRY/nutrition-os-api:COMMIT_SHA .\`.
   Push into the staging registry, obtain the immutable \`@sha256:...\` digest and verify the signature/SBOM. Obtain the PostgreSQL 16 image digest from the chosen trusted registry.
2. Create \`infra/staging/.env.staging\` from \`infra/staging/.env.example\`, replace **every** placeholder, generate separate long random secrets, ensure credentials are URL encoded in both DSNs, set HOS and bridge HTTPS JWKS/issuer/audience, then \`chmod 600 infra/staging/.env.staging\`. Do NOT commit or paste it into GitHub issues or logs.
3. Run \`node scripts/staging/preflight.mjs infra/staging/.env.staging\`. A nonzero exit blocks deploy.
4. \`docker compose --env-file infra/staging/.env.staging -f infra/staging/compose.yml up -d postgres\`.
5. \`docker compose --env-file infra/staging/.env.staging -f infra/staging/compose.yml --profile migration run --rm migration\`.
6. Apply approved least-privilege grants **using the independent migrator**:
   \`docker compose --env-file infra/staging/.env.staging -f infra/staging/compose.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d nutrition_os_staging < infra/staging/grant-app-role.sql\`.
7. \`docker compose --env-file infra/staging/.env.staging -f infra/staging/compose.yml up -d api\`.
8. Configure Nginx/Caddy/managed TLS proxy on the host to forward only the staging API hostname to 127.0.0.1:3001, with HTTPS, HSTS, request limits, WAF/auth rate controls, and no database/admin/worker port exposure. Configure a separate staging frontend origin with the authenticated provider flow; do not use browser-pasted production tokens.
9. Configure GitHub environment \`nutrition-staging\` with:
   - vars \`NUTRITION_STAGING_WEB_URL\`, \`NUTRITION_STAGING_API_URL\`, \`NUTRITION_STAGING_SYNTHETIC_ACCOUNT=true\` only for a dedicated synthetic user.
   - secret \`NUTRITION_STAGING_TEST_USER_TOKEN\` (short-lived valid HOS-issued JWT for that synthetic account, scoped to Nutrition, rotated before each run).
   - protected environment reviewers as applicable. Never use personal or production access tokens.
10. Trigger workflow \`Phase 8.1 — External staging certification\` from \`main\`. Optionally enable the one synthetic write/retire drill via workflow input (never against a real person's account).
11. Download the metadata-only evidence and separately attach: HOS engine installation+revocation evidence, two-way event delivery receipts, Family OS consent/revocation, clinical/dietary safety review, DPIA/export/deletion, independent browser/accessibility audit, DB encryption/PITR restore timing, live p95/SLO and incident drills, operator release signoff. Staging harness cannot automatically approve these gates.
12. Only when all controls have independently verified evidence, update the Phase 8 release evidence register and run \`node scripts/release-gate.mjs --require-ready\`. Never rewrite the register to \`verified\` without real proof.

## Certification status and blockers
| Gate | Status |
|---|---|
| Phase 8 baseline CI / Pages sample preview | PASS: actual GitHub Actions evidence |
| Staging compose / digest-ready infrastructure templates | IMPLEMENTED; NOT DEPLOYED |
| Offline secret/image/JWKS and expected-denial tests | IMPLEMENTED; CI |
| Remote API/identity/synthetic-staging tests | READY TO RUN; missing hostname, secrets and real Kernel identity |
| Separate production domain PostgreSQL instance | BLOCKED; no dedicated staging environment |
| HOS OIDC bridge, engine install, Kernel ↔ Nutrition signed events | BLOCKED; HumanKernelOS issue #5 |
| Family OS canonical membership/consent | BLOCKED |
| Production browser auth and full multi-role E2E | BLOCKED; real HOS identity flow |
| Real clinical/allergen/minor nutrition safety signoff | BLOCKED |
| DPIA, retention/export/erasure, independent security review | BLOCKED |
| Encrypted offsite backups/PITR, load/chaos/SLO/IR, WAF/TLS hardening | BLOCKED |
| Independent operator go-live approval | BLOCKED |

**Release verdict: NOT READY**. A successful dry-run, basic API staging smoke, or Pages deployment is never equivalent to full live cross-system staging certification or production approval. No production DNS, provider trust, secrets or private data are provisioned without a dedicated authorized staging environment.
