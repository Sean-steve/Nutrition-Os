#!/bin/sh
set -eu
: "${STAGING_APP_DB_PASSWORD:?Never initialize a shared DB without a dedicated app role secret}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$STAGING_APP_DB_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE nutrition_app LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'app_password'
) WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nutrition_app') \gexec
ALTER ROLE nutrition_app NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
SQL
