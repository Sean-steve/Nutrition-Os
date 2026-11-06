# Phase L1 — Local Activation & Full-System Tests

## Scope and honesty
Phase L1 adds an Ubuntu local launcher, fail-closed environment doctor, and separate test/certification entry points. GitHub CI validates code and an ephemeral PostgreSQL but **cannot run anything on the user's Ubuntu laptop**. Keep machine-specific signoff separate.

## Docker local activation (recommended)
Requirements: Node 22+, npm, curl, Docker with Compose plugin. Clone/pull the project, then execute from repository root:
```bash
git pull --ff-only origin main
bash scripts/local/up.sh docker
```
The launcher creates server/.env only if it does not exist (with a new local JWT secret), starts only the project's PostgreSQL on 127.0.0.1:5436, installs packages, applies migrations 001–005, and starts Fastify and Vite. It does not delete data, stop unrelated containers, or modify an existing .env.

With the local app running, use another terminal:
```bash
npm --prefix server run --silent dev:token
```
Open http://127.0.0.1:5173/?mode=live and paste the short-lived **development-only** token. This token remains in browser memory and must not be placed on a public website. The sample UI at ?mode=preview is separate and NOT real account data.

## Native Ubuntu PostgreSQL — without Docker
Create a dedicated empty PostgreSQL 16 database and two distinct roles: a schema migration owner and a restricted nutrition_app HTTP user (NOSUPERUSER, NOBYPASSRLS). Configure BOTH connection URLs in server/.env with the existing Ubuntu PostgreSQL port and correct credentials. Copy server/.env.example for the template and replace its demo credentials and LOCAL_IDENTITY_SECRET with fresh values.

Do not point at an existing production DB. Use ENABLE_DEV_DB_ROLE=true only if your local migration role is expressly authorized to bootstrap the app role; set DEV_DB_ROLE_PASSWORD equal to the app URL password. Ensure migrations have appropriate CREATE and GRANT privileges; migration and API roles must be different.
```bash
cp server/.env.example server/.env
chmod 600 server/.env
# Edit DATABASE_URL and MIGRATION_DATABASE_URL for your native PostgreSQL
# Also replace LOCAL_IDENTITY_SECRET with 32+ random characters
bash scripts/local/up.sh native
```
Vite proxies /api to 127.0.0.1:3001, independent of your PostgreSQL port.

## Full certification on your Ubuntu machine
```bash
bash scripts/local/certify.sh
```
This runs frontend TypeScript/unit/build, backend TypeScript/unit/PostgreSQL integration, and desktop/mobile Playwright tests using a fresh randomly generated synthetic account. You can install Chromium with npx playwright install chromium if it is missing. Test data must remain in the dedicated LOCAL development database. Do not use production records or login credentials. Machine-specific certification requires the user to run this command on Ubuntu.

Read-only diagnostics:
```bash
node scripts/local/doctor.mjs --config
node scripts/local/doctor.mjs --ready
```
The doctor never prints passwords, database URLs, secrets or JWTs. It denies remote or non-local PostgreSQL/APIs in L1 mode.

## Manual workflow acceptance
1. Sign in to an empty live account (sample meals never appear). Add food, recipe and an observed meal; refresh and verify persistence, correct the meal and verify recalculated totals.
2. Add hydration, verify Progress and Insights only use observed days; absence must remain unknown.
3. Create/approve a weekly plan, generate groceries, record KES paid manually, explicitly receive stock and inspect inventory movements.
4. Transfer and discard a small synthetic stock lot; verify waste/expiry and nonnegative balance behavior.
5. Create a synthetic family kitchen, invite an independent second test subject, accept and verify owner/viewer permissions and private intake isolation.
6. Inspect Integrations; it should show no made-up HOS engine grants. Live Kernel and Family OS federation is deliberately unavailable until actual identity/event infrastructure exists.
7. Stop the API and verify that live UI shows an error rather than injecting preview fixtures; restore API and retry.

## Still outstanding
AI model, verified nutrient sources, medical safety, HOS external engine installation, Family OS authoritative consent and production staging remain outside L1. A successful local test does not mean the full original vision or production deployment is complete.