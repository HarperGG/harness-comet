#!/usr/bin/env bash

set -euo pipefail

REGISTRY="${INTERNAL_NPM_REGISTRY:-http://nexus.gwm.cn/repository/npm-releases/}"

echo "Publishing Harness-Comet packages to:"
echo "$REGISTRY"

for file in ./artifacts/npm/*.tgz; do
  echo
  echo "Checking $file"

  name="$(tar -xOf "$file" package/package.json | node -e \
    "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).name))")"

  version="$(tar -xOf "$file" package/package.json | node -e \
    "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).version))")"

  if npm view "$name@$version" version \
    --registry="$REGISTRY" >/dev/null 2>&1; then
    echo "Already exists, skip: $name@$version"
    continue
  fi

  echo "Publishing: $name@$version"

  npm publish "$file" \
    --registry="$REGISTRY"
done

echo
echo "Internal registry publish complete."