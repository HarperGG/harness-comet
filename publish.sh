PUBLIC_REGISTRY="https://registry.npmjs.org/"

for file in ./artifacts/npm/*.tgz; do
  echo "Publishing to public npm: $file"

  npm publish "$file" \
    --access public \
    --registry="$PUBLIC_REGISTRY" || exit 1
done