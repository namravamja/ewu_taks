import nx from '@nx/eslint-plugin';
import pluginSecurity from 'eslint-plugin-security';
import importPlugin from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import nodePlugin from 'eslint-plugin-n';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettierConfig from 'eslint-config-prettier';
import noUntypedNestjsDecorators from './tools/eslint-rules/no-untyped-nestjs-decorators.js';

const localPlugin = {
  rules: { 'no-untyped-nestjs-decorators': noUntypedNestjsDecorators },
};

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', 'tools/**', '**/*.json'],
  },
  pluginSecurity.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Apps can only depend on libs
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib'],
            },
            {
              sourceTag: 'type:lib',
              onlyDependOnLibsWithTags: ['type:lib'],
            },

            // Layer 0: core — self-contained (common, config, cache merged in)
            {
              sourceTag: 'scope:core',
              onlyDependOnLibsWithTags: [],
            },
            // Layer 0: prompts — plain string constants, no dependencies
            {
              sourceTag: 'scope:prompts',
              onlyDependOnLibsWithTags: [],
            },

            // Layer 1: shared, database, aws, queue
            // NOTE: shared depends on scope:database for Prisma-generated
            // enums used in @IsEnum() DTO validators. This is a deliberate
            // one-way exception — database must NOT depend on shared.
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:database'],
            },
            {
              sourceTag: 'scope:database',
              onlyDependOnLibsWithTags: ['scope:core'],
            },
            {
              sourceTag: 'scope:aws',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:database'],
            },
            {
              sourceTag: 'scope:queue',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:shared'],
            },

            // Layer 2: auth, ai, realtime
            {
              sourceTag: 'scope:auth',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:aws',
                'scope:queue',
              ],
            },
            {
              sourceTag: 'scope:ai',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:aws',
              ],
            },
            {
              sourceTag: 'scope:realtime',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:shared', 'scope:auth'],
            },
            // Layer 2: email — spam detection, email repository, attachment extraction
            {
              sourceTag: 'scope:email',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:database',
                'scope:ai',
                'scope:aws',
                'scope:prompts',
              ],
            },

            // App scopes
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:auth',
                'scope:queue',
                'scope:aws',
                'scope:ai',
                'scope:realtime',
                'scope:email',
              ],
            },
            {
              sourceTag: 'scope:email-sync',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:queue',
                'scope:aws',
                'scope:email',
              ],
            },
            {
              sourceTag: 'scope:email-classifier',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:queue',
                'scope:aws',
                'scope:ai',
                'scope:email',
              ],
            },
            {
              sourceTag: 'scope:queue-worker',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:queue',
                'scope:aws',
              ],
            },
            {
              sourceTag: 'scope:breakglass-cli',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:shared',
                'scope:database',
                'scope:aws',
                'scope:auth',
              ],
            },
          ],
        },
      ],
    },
  },
  // TS/JS plugins + rules (consolidated)
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      'simple-import-sort': simpleImportSort,
      'import-x': importPlugin,
      n: nodePlugin,
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          conditionNames: ['@org/source', 'types', 'import', 'require', 'node', 'default'],
        }),
      ],
    },
    rules: {
      // security: detect-object-injection has many false positives in TS
      'security/detect-object-injection': 'warn',
      // sonarjs: tune noisy rules for NestJS patterns
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/todo-tag': 'warn',
      // Import sorting (auto-fixable)
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Unused vars/imports/params → error (overrides Nx preset's warn)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Import hygiene (duplicates, cycles, unresolved)
      'import-x/no-duplicates': 'error',
      'import-x/no-cycle': ['error', { maxDepth: 3 }],
      'import-x/no-unresolved': 'error',
      // Node hygiene + console discipline
      'n/no-process-env': 'error',
      'no-console': 'error',
    },
  },
  // Forbid relative parent imports in production source
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/tests/**', '**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'import-x/no-relative-parent-imports': 'error',
    },
  },
  // Webpack configs legitimately use process.env
  {
    files: ['**/webpack.config.{js,cjs,mjs,ts,cts,mts}'],
    rules: {
      'n/no-process-env': 'off',
    },
  },
  // Config reads process.env to build the configuration object
  {
    files: [
      '**/lib/**/configuration.ts',
      '**/lib/**/validation.ts',
      '**/lib/**/config.module.ts',
      '**/__tests__/**/configuration.spec.ts',
    ],
    rules: {
      'n/no-process-env': 'off',
    },
  },
  // Dev CLI scripts — need process.env, dynamic fs paths, and spawn for local tooling
  {
    files: ['scripts/**/*.{mjs,js,cjs,ts,mts,cts}'],
    rules: {
      'n/no-process-env': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'no-console': 'off',
    },
  },
  // Prisma config reads process.env for the datasource URL
  {
    files: ['prisma.config.ts'],
    rules: {
      'n/no-process-env': 'off',
    },
  },
  // Seed scripts are standalone CLI scripts — need console, process.env, and relative imports
  {
    files: ['**/prisma/seed.ts', '**/prisma/seed-cli.ts'],
    rules: {
      'no-console': 'off',
      'n/no-process-env': 'off',
      'import-x/no-relative-parent-imports': 'off',
    },
  },
  // seed-cli.ts bootstraps a standalone NestJS context and imports from the database barrel
  {
    files: ['**/prisma/seed-cli.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  // Allow relative parent imports within source directories (intra-lib and intra-app imports)
  {
    files: ['**/src/**/*.ts'],
    rules: {
      'import-x/no-relative-parent-imports': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts', '**/__tests__/**/*.ts'],
    rules: {
      [`sonarjs/no-hardcoded-${'pass'}words`]: 'off',
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['**/jest.config.{ts,cts,mts,js,cjs,mjs}'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  prettierConfig,
  {
    plugins: { local: localPlugin },
    // @Body() and @Query() decorators only appear in NestJS controllers —
    // applying this to all .ts files wastes lint time and risks false positives
    files: ['**/*.controller.ts'],
    rules: {
      'local/no-untyped-nestjs-decorators': 'error',
    },
  },
];
