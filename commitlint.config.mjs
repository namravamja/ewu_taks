export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'scope-ms-ticket': ({ scope }) => {
          if (!scope) return [true];
          if (/^MS-\d+$/.test(scope)) return [true];
          return [false, 'scope, when provided, must be a ticket number (e.g. MS-1855)'];
        },
      },
    },
  ],
  rules: {
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
    'scope-enum': [0],
    'scope-empty': [0],
    'scope-ms-ticket': [2, 'always'],
  },
};
