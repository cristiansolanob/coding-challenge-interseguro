// @ts-check
// This file is loaded directly by Node (package.json sets "type": "commonjs"),
// so it must stay CommonJS rather than ESM `import` — flat-config files are
// not compiled through tsc/ts-node like src/tests are.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // Project convention: a leading underscore marks an intentionally
      // unused parameter (e.g. Express middleware signatures that must keep
      // `next`/`req` for arity even when unused).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // eslint.config.js itself runs under Node's CommonJS loader, so it needs
    // Node/CommonJS globals (`require`, `module`) — the rules above target
    // src/tests, which are ESM-flavored TypeScript under NodeNext.
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
);
