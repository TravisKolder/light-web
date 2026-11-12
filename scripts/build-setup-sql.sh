#!/usr/bin/env bash
# Bundle every migration plus the fictional seed into one script for the
# Supabase SQL Editor (new, empty project only). Usage:
#   bash scripts/build-setup-sql.sh > light-web-setup.sql
set -euo pipefail
cd "$(dirname "$0")/.."
echo "-- Light Web: full database setup for a NEW, EMPTY Supabase project."
echo "-- Generated $(date -u +%F) from supabase/migrations/*.sql + supabase/seed.sql (fictional sample data)."
echo "-- Paste into the Supabase SQL Editor and click Run once. Do not run twice."
echo "begin;"
for f in supabase/migrations/*.sql supabase/seed.sql; do
  printf '\n-- ===== %s =====\n' "$f"
  cat "$f"
done
printf '\ncommit;\n'
