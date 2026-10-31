#!/usr/bin/env bash
# Offline structural CI check; all credentials are disposable dummy strings.
set -euo pipefail
export STAGING_POSTGRES_IMAGE="postgres:16-alpine@sha256:$(printf 'a%.0s' {1..64})"
export NUTRITION_STAGING_IMAGE="ghcr.io/example/nutrition-os@sha256:$(printf 'b%.0s' {1..64})"
export STAGING_POSTGRES_PASSWORD="CI_dummy_admin_secret_not_for_deployment_123"
export STAGING_APP_DB_PASSWORD="CI_dummy_app_secret_not_for_deployment_456"
export STAGING_MIGRATION_DATABASE_URL="postgresql://postgres:${STAGING_POSTGRES_PASSWORD}@postgres:5432/nutrition_os_staging"
export STAGING_APP_DATABASE_URL="postgresql://nutrition_app:${STAGING_APP_DB_PASSWORD}@postgres:5432/nutrition_os_staging"
export STAGING_WEB_ORIGIN="https://staging.example.invalid"
export KERNEL_JWKS_URL="https://hos.example.invalid/user-jwks"
export KERNEL_ISSUER="https://hos.example.invalid"
export KERNEL_AUDIENCE="nutrition-os-api"
export KERNEL_BRIDGE_JWKS_URL="https://hos.example.invalid/service-jwks"
export KERNEL_BRIDGE_ISSUER="https://hos.example.invalid/service"
export KERNEL_BRIDGE_AUDIENCE="nutrition-kernel-bridge"
config="$(mktemp)"
trap 'rm -f "$config"' EXIT
docker compose --profile migration -f infra/staging/compose.yml config --format json > "$config"
node - "$config" <<'JS'
const fs=require('node:fs');
const value=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const db=value.services?.postgres,api=value.services?.api,migration=value.services?.migration;
if(!db||!api||!migration)throw new Error('Missing staged PostgreSQL/API/migrator services');
if(db.ports?.length)throw new Error('Database cannot have any published ports');
if(!api.read_only||api.user!=='10001:10001')throw new Error('API must be read-only and nonroot');
if(!api.ports?.every(p=>p.host_ip==='127.0.0.1'))throw new Error('API must bind loopback only');
if(!api.environment||api.environment.LOCAL_IDENTITY_ENABLED!=='false')throw new Error('Developer tokens must not be accepted');
if(migration.environment?.MIGRATION_DATABASE_URL===api.environment?.DATABASE_URL)
 throw new Error('Migration role and application role must use distinct credentials');
if(!Object.hasOwn(db.networks??{},'private_data')||!Object.hasOwn(api.networks??{},'private_data')||!Object.hasOwn(api.networks??{},'outgoing_https'))
 throw new Error('Staging private DB network and separate HTTPS egress are required');
console.log('Staging Compose structure: private DB, loopback API, separate migrator, nonroot read-only API — PASS');
JS
bash -n infra/staging/init-app-role.sh
