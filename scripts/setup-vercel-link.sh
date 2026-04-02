#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not found. Install Node.js (which includes npx) and re-run this script." >&2
  exit 1
fi

echo "🔐 Starting Vercel login..."
npx vercel login

echo "🔗 Linking this repo to an existing Vercel project (or creating a new one)..."
npx vercel link

echo "✅ Vercel CLI is authenticated and the project is linked."
