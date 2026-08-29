// ESLint 9 — flat config (remplace l'ancien `next lint`).
// Portée : le front Next.js (app, components, hooks, lib) + scripts.
// Le daemon (Go), le studio (Vue, apps/) et les artefacts sont ignorés.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'apps/**',
      'daemon/**',
      'data/**',
      'logs/**',
      'next-env.d.ts',
      'next.config.mjs',
      'postcss.config.mjs',
      'tailwind.config.ts',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    rules: {
      // `any` est toléré : le vrai garde-fou est tsc (strict:true).
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Les scripts CommonJS (.cjs) utilisent légitimement require().
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
