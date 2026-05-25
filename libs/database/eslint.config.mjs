import { createLibConfig } from '../../eslint.lib.config.mjs';

export default [
  ...createLibConfig(import.meta.dirname),
  {
    files: ['prisma/seed.ts', 'prisma/seed-cli.ts', 'prisma/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      'n/no-process-env': 'off',
      'import-x/no-relative-parent-imports': 'off',
    },
  },
  {
    files: ['prisma/seed-cli.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
];
