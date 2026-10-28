#!/usr/bin/env bash
# Runs the database tests against an empty PostgreSQL database.
#   PGHOST=... PGPORT=... PGUSER=postgres PGDATABASE=... supabase/tests/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
psql -X -q -v ON_ERROR_STOP=1 -f "$here/00_supabase_stub.sql"
for f in "$here"/../migrations/*.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -X -q -v ON_ERROR_STOP=1 -f "$here/10_security_and_triggers.sql"
