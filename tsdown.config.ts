import { defineConfig } from 'tsdown'

const bundledDependencies = ['commander', 'yaml', 'zod']

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts'
    },
    format: 'esm',
    platform: 'node',
    deps: {
      alwaysBundle: bundledDependencies,
      onlyBundle: bundledDependencies,
      dts: {
        neverBundle: bundledDependencies
      }
    },
    dts: true,
    sourcemap: true,
    fixedExtension: false,
    exports: true
  },
  {
    entry: {
      'develop-loop': 'src/cli.ts'
    },
    outDir: 'skills/develop-loop/scripts',
    format: 'esm',
    platform: 'node',
    deps: {
      alwaysBundle: bundledDependencies,
      onlyBundle: bundledDependencies
    },
    outputOptions: {
      codeSplitting: false
    },
    clean: true,
    dts: false,
    sourcemap: false,
    fixedExtension: false,
    exports: false
  }
])
