#!/usr/bin/env bash
# Disposable CI-only PostgreSQL backup and restore proof. NEVER for production.
set -euo pipefail
if [[ "$CI" != "true" || "$NODE_ENV" != "test" ]]; then
  echo "Refusing outside disposable CI test mode." >&2
  exit 2
fi
for cmd in docker node mktemp; do
  command -v "$cmd" >/dev/null || { echo "Missing restore tool: $cmd" >&2; exit 2; }
done
restore_db="nutrition_os_restore_ci"
restore_url="$(node -e "const u=new URL(process.env.MIGRATION_DATABASE_URL);u.pathname='/nutrition_os_restore_ci';console.log(u.toString())")"
backup_dir="$(mktemp -d /tmp/nutrition-os-ci-backup-XXXXXX)"
backup="$backup_dir/backup.dump"
# PostgreSQL server and restore client MUST use the same major version.
pgclient() {
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -v "$backup_dir:/work" postgres:16-alpine "$@"
}
cleanup() {
  pgclient psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS nutrition_os_restore_ci WITH (FORCE);" >/dev/null || true
  rm -rf "$backup_dir"
}
trap cleanup EXIT
pgclient psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS nutrition_os_restore_ci WITH (FORCE);" >/dev/null
pgclient pg_dump --dbname="$MIGRATION_DATABASE_URL" --format=custom --no-owner --no-acl --file=/work/backup.dump
test -s "$backup" || { echo "Backup is empty" >&2; exit 1; }
pgclient psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE nutrition_os_restore_ci;" >/dev/null
pgclient pg_restore --exit-on-error --no-owner --no-acl --dbname="$restore_url" /work/backup.dump
for table in schema_migrations profile food recipe meal inventory_movement event_outbox audit_event kernel_binding kernel_grant; do
  original="$(pgclient psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM nutrition.$table;")"
  restored="$(pgclient psql "$restore_url" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM nutrition.$table;")"
  if [[ "$original" != "$restored" ]]; then
    echo "Restore count mismatch: nutrition.$table" >&2
    exit 1
  fi
done
applied="$(pgclient psql "$restore_url" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM nutrition.schema_migrations;")"
if [[ "$applied" != "5" ]]; then echo "Not all migrations were restored" >&2; exit 1; fi
policies="$(pgclient psql "$restore_url" -v ON_ERROR_STOP=1 -At -c "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nutrition' AND c.relname IN ('meal','household','kernel_binding') AND c.relrowsecurity AND c.relforcerowsecurity;")"
if [[ "$policies" != "3" ]]; then echo "Restored RLS mismatch" >&2; exit 1; fi
echo "CI restore drill: 5 migrations, 10 representative data/ledger comparisons and 3 FORCE RLS tables confirmed."
echo "This is NOT a production PITR, encrypted backup, RPO or RTO certification."
