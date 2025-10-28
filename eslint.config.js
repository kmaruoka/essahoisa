import tseslint from 'typescript-eslint';
import eslintPluginImport from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: eslintPluginImport,
      'unused-imports': unusedImports
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'unused-imports/no-unused-imports': 'error'
    },
    settings: {
      'import/resolver': {
        typescript: true
      }
    }
  }
];
