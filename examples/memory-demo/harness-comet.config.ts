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
    default: "memory",
    entries: {
      memory: "@harness-comet/adapter-memory"
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
