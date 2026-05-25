import baseConfig from './eslint.config.mjs';
import nestjsTyped from '@darraghor/eslint-plugin-nestjs-typed';
import prettierConfig from 'eslint-config-prettier';
import jsoncParser from 'jsonc-eslint-parser';
import { defineConfig } from 'eslint/config';

export function createLibConfig(dirname, extraConfigs = []) {
  return defineConfig(
    ...baseConfig,
    {
      files: ['**/*.json'],
      rules: {
        '@nx/dependency-checks': [
          'error',
          { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'] },
        ],
      },
      languageOptions: { parser: jsoncParser },
    },
    {
      files: ['**/*.ts'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: dirname,
        },
      },
    },
    ...nestjsTyped.configs.flatRecommended.map((config) => ({
      ...config,
      files: ['**/*.ts'],
    })),
    {
      files: ['**/*.ts'],
      rules: {
        '@darraghor/nestjs-typed/all-properties-are-whitelisted': [
          'error',
          { additionalDecorators: ['IsValidPassword', 'Match'] },
        ],
        '@darraghor/nestjs-typed/all-properties-have-explicit-defined': [
          'error',
          { additionalDecorators: ['IsValidPassword', 'Match'] },
        ],
        '@darraghor/nestjs-typed/validate-nested-of-array-should-set-each': 'off',
        '@darraghor/nestjs-typed/injectable-should-be-provided': 'off',
      },
    },
    ...extraConfigs,
    prettierConfig,
  );
}
