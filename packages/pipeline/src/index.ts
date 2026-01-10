// Main pipeline orchestration
export { main } from './orchestrator'

// Individual pipeline components
export { runScout } from './scout'
export { runFetcher } from './fetcher'
export { runNormalizer } from './normalizer'

// Scout-specific functionality
export { classifyDatasets } from './scoutAgent'

// Testing utilities
export { testConnector } from './lib/testConnector' 