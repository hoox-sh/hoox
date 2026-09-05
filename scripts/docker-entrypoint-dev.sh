#!/bin/sh
# Copyright (c) 2026 HOOX · jango-blockchained (hoox-sh)
# SPDX-License-Identifier: Apache-2.0
#
# Compose bind-mounts ./packages over the image, so shared/dist from the
# image build is hidden. Build it on first start if missing. Also copy
# gitignored wrangler.jsonc from .example so wrangler dev can boot.
set -eu

if [ ! -f /app/packages/shared/dist/index.js ] && [ -f /app/packages/shared/package.json ]; then
  echo "docker-entrypoint: building packages/shared (dist missing on bind mount)"
  bun run --cwd /app/packages/shared build
fi

for example in /app/workers/*/wrangler.jsonc.example /app/workers/dashboard/wrangler.jsonc.example; do
  [ -f "$example" ] || continue
  dest="${example%.example}"
  if [ ! -f "$dest" ]; then
    echo "docker-entrypoint: $dest ← $(basename "$example")"
    cp "$example" "$dest"
  fi
done

exec "$@"
