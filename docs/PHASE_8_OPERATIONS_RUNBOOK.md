# Nutrition OS — Production Operations and Disaster Recovery Runbook

Status: PROCEDURE DRAFT — no live production deployment, backup service or HOS identity provider certified.

## Deployment trust boundaries
Use distinct production identity issuer/JWKS for users and separate, short-lived machine-service issuer for Kernel governance/events. Sign claims server-side; never expose the keys or test tokens to Vite or GitHub Pages. Enforce a real registered and ENABLED/RUNNING engine, signed consent and Family membership attestations for shared records. Disable outbound publishing until an approved Kernel Event Mesh consumer exists.

The API process must use a non-superuser, NOBYPASSRLS PostgreSQL role and MUST NOT receive separate migration credentials. Run DB migrations as a separately approved one-shot deployment job, with a verified backup, backward-compatible schema strategy and rollback plan.

## Network / TLS
Expose only application HTTPS at a reverse proxy. Restrict database, migration, Redis or outbox workers to private network paths. Rate-limit sensitive authenticated endpoints, enforce WAF and request size limits, rotate TLS certificates and implement CSP/HSTS at the proxy. The API itself exposes no secrets through liveness or readiness probes.

## Backups
Encrypt database backups and PostgreSQL WAL, retain immutable offsite copies under an approved policy and verify restoration to quarantine. Define numeric RPO and RTO targets with the operator first; measure real elapsed restore and consistency before claiming compliance. Verify tenant/user RLS, extension availability, audit/event ledger, reconciliation and credentials after restore.

CI recovery script is ONLY for disposable test databases. It deliberately refuses production use.

## Monitoring and alerts
Telemetry must cover request error rates, API readiness, p95 latency, DB connection failures, disk space, replication lag, backup age, event outbox queue lag and dead letters, consent denials, signature failure, and suspicious cross-tenant access. Redact bearer tokens, food narratives, medical data and household identifiers from logs.

## Incident procedures
Identity compromise: revoke the Kernel grants, rotate affected signing keys, disable event publishing, preserve audit trail, engage privacy incident process and notify appropriately. Backup incident: stop writes safely, snapshot evidence, restore into quarantine, compare checksums and complete authorization before switching over. Broker outage: never mark an event delivered before accepted receipt; replay with stable event IDs after recovery.

## Release and rollback
Deploy an immutable build to staging, apply one-shot migrations as the privileged migrator, run signed user/Kernel/Family role journeys, observe monitoring and run an actual rollback simulation. Promote through a small controlled cohort with kill switches; rollback binaries only if schema remains compatible. Never truncate nutrition event, audit, stock or financial ledgers to recover from an error.

## Production proof required
Independent HOS install and SSO, Family OS membership, authorized Event Mesh, clinical/allergen assessment, DPIA and personal-data rights, full browser accessibility, production encrypted backups and a timed restore, SLO/incident runbook exercise, signoff and correct GitHub Pages preview configuration.

Until all release evidence is verified, stop at NOT READY.
