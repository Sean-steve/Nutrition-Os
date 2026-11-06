#!/usr/bin/env bash
# Phase L1 local-only launcher. No other project containers are stopped.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
mode="${1:-docker}"
if [[ "$mode" != "docker" && "$mode" != "native" ]]; then
  echo "Usage: bash scripts/local/up.sh [docker|native]" >&2; exit 2
fi
for bin in node npm curl; do
  command -v "$bin" >/dev/null || { echo "Install $bin before starting." >&2; exit 2; }
done
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)" || {
 echo "Node 22+ is required." >&2; exit 2;
}
if [[ ! -f server/.env ]]; then
 if [[ "$mode" == "native" ]]; then echo "Set up server/.env with a dedicated native PostgreSQL first." >&2; exit 2; fi
 cp server/.env.example server/.env
 chmod 600 server/.env
 node -e "const fs=require('node:fs'),c=require('node:crypto'),p='server/.env';let s=fs.readFileSync(p,'utf8');s=s.replace(/^LOCAL_IDENTITY_SECRET=.*$/m,'LOCAL_IDENTITY_SECRET='+c.randomBytes(32).toString('hex'));fs.writeFileSync(p,s,{mode:0o600})"
 echo "Created server/.env with a fresh local-only JWT signing secret."
fi
node scripts/local/doctor.mjs --config
if [[ "$mode" == "docker" ]]; then
 command -v docker >/dev/null || { echo "Docker not found; use native mode with your Ubuntu PostgreSQL." >&2; exit 2; }
 docker compose version >/dev/null || { echo "Docker Compose plugin not available." >&2; exit 2; }
 echo "Starting only Nutrition OS PostgreSQL on 127.0.0.1:5436."
 docker compose -f docker-compose.backend.yml up -d
fi
npm install --no-audit --no-fund
npm --prefix server install --no-audit --no-fund
npm --prefix server run db:migrate
api_pid="" ; web_pid=""
cleanup(){
 [[ -z "$api_pid" ]] || kill "$api_pid" 2>/dev/null || true
 [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true
 wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
npm --prefix server run dev & api_pid=$!
for attempt in $(seq 1 60); do
 if curl --silent --fail --max-time 1 http://127.0.0.1:3001/health/ready >/dev/null; then break; fi
 if ! kill -0 "$api_pid" 2>/dev/null; then echo "Backend quit; inspect its startup error." >&2; exit 1; fi
 sleep 1
done
curl --silent --fail --max-time 3 http://127.0.0.1:3001/health/ready >/dev/null || {
 echo "API failed readiness. Check PostgreSQL / server/.env." >&2; exit 1;
}
npm run dev -- --host 127.0.0.1 & web_pid=$!
printf '\nNutrition OS API: http://127.0.0.1:3001/health/ready\n'
printf 'Nutrition OS UI:  http://127.0.0.1:5173/?mode=live\n'
printf 'For a login token, open another terminal and run:\n'
printf '  npm --prefix server run --silent dev:token\n'
printf 'Ctrl+C stops these app processes; the database remains intact.\n\n'
wait -n "$api_pid" "$web_pid" || true
echo "Frontend/backend process stopped. Shutting down local app processes."
