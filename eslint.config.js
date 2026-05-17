const prettierConfig = require('./.prettierrc.json');

module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      prettier: require('eslint-plugin-prettier'),
    },
    rules: {
      'prettier/prettier': ['error', prettierConfig],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'pnpm-lock.yaml', '.claude/'],
  },
];
