import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // The engine must stay pure: no DOM, no network, no React.
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: globals.es2021 },
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'fetch',
        'XMLHttpRequest',
        'localStorage',
      ],
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', '**/ui/**'] }],
    },
  },
  prettier,
])
