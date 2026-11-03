import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores:['node_modules/**','dist/**','tmp/**','artifacts/**','output/**','qa-evidence/**','playwright-report/**','test-results/**'] },
  { files:['api/**/*.mjs','shared/**/*.mjs','ops/**/*.mjs','tests/**/*.mjs','*.mjs'], ...js.configs.recommended,
    languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:globals.node},
    rules:{...js.configs.recommended.rules,'no-unused-vars':['error',{args:'none',caughtErrors:'none',varsIgnorePattern:'^_'}]} },
  { files:['src/**/*.{ts,tsx}'],
    languageOptions:{parser:babelParser,globals:{...globals.browser},parserOptions:{requireConfigFile:false,babelOptions:{babelrc:false,configFile:false,plugins:[['@babel/plugin-syntax-typescript',{isTSX:true}]]}}},
    plugins:{'react-hooks':hooks},
    rules:{'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn','no-debugger':'error','no-constant-condition':'error'} },
];
