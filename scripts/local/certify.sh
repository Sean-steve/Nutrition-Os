#!/usr/bin/env bash
# Phase L1 operator-invoked certification; only use on an isolated local test DB.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
node scripts/local/doctor.mjs --ready
echo 'Running frontend TypeScript, unit suite and release build…'
npm run check
npm run test
npm run build
echo 'Running backend TypeScript, unit tests and PostgreSQL integration workflows…'
npm --prefix server run check
npm --prefix server run test
NODE_ENV=test npm --prefix server run test:integration
echo 'Running desktop/mobile Playwright using a new synthetic signed user…'
export USER_ID
export TENANT_ID
USER_ID="$(node -e "process.stdout.write(require('node:crypto').randomUUID())")"
TENANT_ID="$(node -e "process.stdout.write(require('node:crypto').randomUUID())")"
export E2E_TEST_TOKEN
E2E_TEST_TOKEN="$(USER_ID="$USER_ID" TENANT_ID="$TENANT_ID" npm --prefix server run --silent dev:token)"
unset USER_ID TENANT_ID
npm run test:e2e
unset E2E_TEST_TOKEN
echo 'Phase L1 local automated certification PASSED. Operator manual checks still required.'
