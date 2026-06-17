import type { Linter } from 'eslint';
import markedEslintConfig from '@markedjs/eslint-config';

const config: Linter.Config[] = [
  {
    ignores: ['**/lib', '**/public', 'test.js', 'vuln.js'],
  },
  ...markedEslintConfig,
];

export default config;
