#!/usr/bin/env bash
set -euo pipefail

# Compare database schema dumps for migration round-trip testing.
# Usage: ./scripts/compare-schema.sh [before|after|diff]
#
# Commands:
#   before  - Dump current schema to /tmp/schema_before.sql
#   after   - Dump current schema to /tmp/schema_after.sql
#   diff    - Compare before and after dumps

DB_URL="${DEV_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "Error: DEV_DB_URL or DATABASE_URL must be set" >&2
  exit 1
fi

# Convert pgx5:// to postgres:// for psql compatibility
DB_URL="${DB_URL//pgx5:\/\//postgres:\/\/}"

dump_schema() {
  local output="$1"
  psql "$DB_URL" -t -c "
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  " > "$output"

  psql "$DB_URL" -t -c "
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  " >> "$output"

  psql "$DB_URL" -t -c "
    SELECT conname, contype, conrelid::regclass, confrelid::regclass
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
    ORDER BY conrelid::regclass::text, conname;
  " >> "$output"
}

case "${1:-diff}" in
  before)
    echo "Dumping schema to /tmp/schema_before.sql..."
    dump_schema /tmp/schema_before.sql
    echo "Done."
    ;;
  after)
    echo "Dumping schema to /tmp/schema_after.sql..."
    dump_schema /tmp/schema_after.sql
    echo "Done."
    ;;
  diff)
    if [[ ! -f /tmp/schema_before.sql ]] || [[ ! -f /tmp/schema_after.sql ]]; then
      echo "Error: Run 'before' and 'after' first" >&2
      exit 1
    fi
    if diff -u /tmp/schema_before.sql /tmp/schema_after.sql; then
      echo "✓ Schemas match"
      exit 0
    else
      echo "✗ Schemas differ"
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [before|after|diff]" >&2
    exit 1
    ;;
esac
