#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not installed. Install Node.js (which bundles npx) and rerun." >&2
  exit 1
fi

ENVIRONMENTS=("production" "preview" "development")
VARS=("DATABASE_URL" "POSTGRES_URL" "PRISMA_DATABASE_URL" "OPENAI_API_KEY")

echo "This script pushes local secret values to Vercel across ${ENVIRONMENTS[*]}."
echo "Existing values will require confirmation inside the Vercel CLI prompts."

for var in "${VARS[@]}"; do
  default_value="${!var:-}"

  if [[ -z "$default_value" && -f .env.local ]]; then
    default_value="$(grep -E "^${var}=" .env.local | sed -e "s/^${var}=//" -e 's/^"//' -e 's/"$//')"
  fi

  if [[ -z "$default_value" && -f .env ]]; then
    default_value="$(grep -E "^${var}=" .env | sed -e "s/^${var}=//" -e 's/^"//' -e 's/"$//')"
  fi

  if [[ -z "$default_value" ]]; then
    read -r -p "No value found for ${var}. Enter a value (or leave blank to skip): " default_value
  else
    echo "Found a value for ${var} (hidden)."
    read -r -p "Use this value for ${var}? [Y/n] " confirm
    confirm_lower="$(printf '%s' "$confirm" | tr '[:upper:]' '[:lower:]')"
    if [[ "$confirm_lower" == "n" ]]; then
      read -r -p "Enter a new value for ${var}: " default_value
    fi
  fi

  if [[ -z "$default_value" ]]; then
    echo "Skipping ${var}."
    continue
  fi

  for env in "${ENVIRONMENTS[@]}"; do
    echo ""
    echo "Setting ${var} for ${env}..."
    set +e
    output="$(printf '%s\n' "$default_value" | npx vercel env add "$var" "$env" 2>&1)"
    status=$?
    set -e

    if [[ $status -ne 0 ]]; then
      if echo "$output" | grep -q "has already been added to all Environments"; then
        echo "⚠️  ${var} already exists for ${env}. To update, run 'npx vercel env rm ${var} ${env}' first."
        continue
      fi
      echo "$output"
      echo "Failed to set ${var} for ${env}. Exiting."
      exit $status
    fi

    echo "$output"
  done
done

echo ""
echo "All requested variables processed."
