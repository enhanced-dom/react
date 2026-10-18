import { jestConfigFactory } from '@enhanced-dom/jest'

const baseConfig = jestConfigFactory({ ts: true, processorConfigPath: new URL('./tsconfig.json', import.meta.url).pathname })

export default {
  ...baseConfig,
  transformIgnorePatterns: ['node_modules/(?!@enhanced-dom/|lodash-es)'],
  setupFiles: ['<rootDir>/setup.ts'],
}
