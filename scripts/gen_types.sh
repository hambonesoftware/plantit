#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../frontend"
npm install
npm run gen:types
echo "Generated frontend/types/api.d.ts"
