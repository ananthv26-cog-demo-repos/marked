import { Lexer } from '../lib/marked.esm.js';
const rules = Lexer.rules;

const COLOR = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fgBlack: '\x1b[30m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

function propsToString(obj: unknown): unknown {
  if (obj === null) {
    return null;
  }
  if (typeof obj === 'object' && obj.constructor.name === 'Object') {
    const rulesObj = obj as Record<string, unknown>;
    const exec = rulesObj.exec;
    if (typeof exec === 'function' && exec.name === 'noopTest') {
      return null;
    }
    for (const prop in rulesObj) {
      rulesObj[prop] = propsToString(rulesObj[prop]);
    }
    return rulesObj;
  }
  return String(obj);
}

let rulesObj: Record<string, unknown> = {};
if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i++) {
    const rulePath = process.argv[i].split('.');
    let rulesList = rulesObj;
    let rule: unknown = rules;
    while (rulePath.length > 1) {
      const prop = rulePath.shift()!;
      if (!rulesList[prop]) {
        rulesList[prop] = {};
        rulesList = rulesList[prop] as Record<string, unknown>;
      }
      if (rule) {
        rule = (rule as Record<string, unknown>)[prop];
      }
    }
    rulesList[rulePath[0]] = (rule as Record<string, unknown> | null)?.[rulePath[0]] ?? null;
  }
} else {
  rulesObj = rules;
}

let output = JSON.stringify(propsToString(rulesObj), null, 2);
output = output.replace(/^(\s*)"(.*)": null,?$/gm, `$1${COLOR.fgGreen}$2${COLOR.reset}: undefined`);
output = output.replace(/^(\s*)"(.*)": {$/gm, `$1${COLOR.fgGreen}$2${COLOR.reset}: {`);
output = output.replace(/^(\s*)"(.*)": "(.*)",?$/gm, (...p: string[]) => {
  return `${p[1]}${COLOR.fgGreen}${p[2]}${COLOR.reset}: ${COLOR.fgRed}${p[3].replace(/\\\\/g, '\\')}${COLOR.reset}`;
});
console.log(output, COLOR.reset);
