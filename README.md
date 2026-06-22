# Harness-Comet

Before running setup, install Comet globally with npm. Use `npm install`, then the global flag `-g`, then the package `@rpamis/comet`.

After Comet is installed, run `pnpm exec harness-comet setup --mode playwright`.

Harness-Comet only checks whether Comet is available. It does not download or install Comet automatically. Comet initialization remains interactive unless `--yes` is explicitly provided.

See [docs/README.md](docs/README.md) for the full documentation.
