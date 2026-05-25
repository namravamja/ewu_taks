export default {
  '*.{ts,tsx,mts,cts}': ['eslint --fix --no-warn-ignored --max-warnings=0', 'prettier --write'],
  '*.{js,jsx,mjs,cjs}': ['eslint --fix --no-warn-ignored --max-warnings=0', 'prettier --write'],
  '*.{json,md,yml,yaml,html,css,scss}': ['prettier --write'],
};
