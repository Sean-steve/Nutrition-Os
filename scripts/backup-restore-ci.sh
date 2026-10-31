#!/usr/bin/env bash
# Disposable CI-only PostgreSQL backup and restore proof. NEVER for production.
set -euo pipefail
if [[ "$CI" != "true" || "$NODE_ENV" != "test" ]]; then
  echo "Refusing outside disposable CI test mode." >&2
  exit 2
fi
for cmd in pg_dump pg_restore psql node mktemp; do
  command -v "$cmd" >/dev/null || { echo "Missing restore tool: $cmd" >&2; exit 2; }
done
restore_db="nutrition_os_restore_ci"
restore_url="$(node -e "const u=new URL(process.env.MIGRATION_DATABASE_URL);u.pathname='/nutrition_os_restore_ci';console.log(u.toString())")"
backup="$(mktemp /tmp/nutrition-os-ci-backup-XXXXXX.dump)"
cleanup() {
  psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS nutrition_os_restore_ci WITH (FORCE);" >/dev/null || true
  rm -f "$backup"
}
trap cleanup EXIT
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS nutrition_os_restore_ci WITH (FORCE);" >/dev/null
pg_dump --dbname="$MIGRATION_DATABASE_URL" --format=custom --no-owner --no-acl --file="$backup"
test -s "$backup" || { echo "Backup is empty" >&2; exit 1; }
psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE nutrition_os_restore_ci;" >/dev/null
pg_restore --exit-on-error --no-owner --no-acl --dbname="$restore_url" "$backup"
for table in schema_migrations profile food recipe meal inventory_movement event_outbox audit_event kernel_binding kernel_grant; do
  original="$(psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM nutrition.$table;")"
  restored="$(psql "$restore_url" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM nutrition.$table;")"
  if [[ "$original" != "$restored" ]]; then
    echo "Restore count mismatch: nutrition.$table" >&2
    exit 1
  fi
done
applied="$(psql "$restore_url" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM nutrition.schema_migrations;")"
if [[ "$applied" != "5" ]]; then echo "Not all migrations were restored" >&2; exit 1; fi
policies="$(psql "$restore_url" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nutrition' AND c.relname IN ('meal','household','kernel_binding') AND c.relrowsecurity AND c.relforcerowsecurity;")"
if [[ "$policies" != "3" ]]; then echo "Restored RLS mismatch" >&2; exit 1; fi
echo "CI restore drill: 5 migrations, 10 representative data/ledger comparisons and 3 FORCE RLS tables confirmed."
echo "This is NOT a production PITR, encrypted backup, RPO or RTO certification."
