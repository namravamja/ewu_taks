import baseConfig from './eslint.config.mjs';
import nestjsTyped from '@darraghor/eslint-plugin-nestjs-typed';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export function createAppConfig(dirname, extraConfigs = []) {
  return defineConfig(
    ...baseConfig,
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
        '@darraghor/nestjs-typed/injectable-should-be-provided': 'off',
      },
    },
    ...extraConfigs,
    prettierConfig,
  );
}
