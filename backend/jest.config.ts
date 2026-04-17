import type { Config } from 'jest'

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        types: ['jest', 'node'],
      },
    }],
  },
  testEnvironment: 'node',
  testTimeout:     15_000,
}

export default config
