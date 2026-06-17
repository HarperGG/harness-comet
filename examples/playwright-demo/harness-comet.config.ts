export default {
  schemaVersion: 1,
  mode: "runtime",
  paths: {
    scenarios: "harness/scenarios",
    fixtures: "harness/fixtures",
    adapters: "harness/adapters",
    oracles: "harness/oracles"
  },
  adapter: {
    default: "playwright",
    entries: {
      playwright: "@hapergg/harness-comet-adapter-playwright"
    }
  },
  runtime: {
    scenarioTimeoutMs: 60000,
    stepTimeoutMs: 15000,
    assertionTimeoutMs: 10000,
    workers: 1,
    failFast: false
  }
};
