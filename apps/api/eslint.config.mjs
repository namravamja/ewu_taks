import { createAppConfig } from '../../eslint.app.config.mjs';

export default createAppConfig(import.meta.dirname, [
  {
    files: ['**/*.ts'],
    rules: {
      // Swagger not yet installed — re-enable as 'warn' when @nestjs/swagger is added
      '@darraghor/nestjs-typed/controllers-should-supply-api-tags': 'off',
      '@darraghor/nestjs-typed/api-method-should-specify-api-response': 'off',
    },
  },
  {
    // False-positive on `Type[] | null` signatures where `null` means "clear the array".
    files: ['**/dtos/update-*.dto.ts'],
    rules: {
      '@darraghor/nestjs-typed/validate-nested-of-array-should-set-each': 'off',
    },
  },
]);
