/**
 * Marked CLI
 * Copyright (c) 2018+, MarkedJS. (MIT License)
 * Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
 */

import { promises } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { marked } from '../src/marked.ts';
import type { MarkedExtension, MarkedOptions } from '../src/MarkedOptions.ts';

const { access, readFile, writeFile } = promises;
const require = createRequire(import.meta.url);

type CliConfigFunction = (markedInstance: typeof marked) => void;
type CliConfig = MarkedExtension | CliConfigFunction;
interface CliConfigModule {
  default?: CliConfig;
}

interface ErrnoException extends Error {
  code?: string;
  path?: string;
}

export async function main(nodeProcess: typeof process): Promise<void> {
  /**
   * Man Page
   */
  async function help(): Promise<void> {
    const { spawn } = await import('child_process');
    const { fileURLToPath } = await import('url');

    const options = {
      cwd: nodeProcess.cwd(),
      env: nodeProcess.env,
      stdio: 'inherit' as const,
    };

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const helpText = await readFile(resolve(__dirname, '../man/marked.1.md'), 'utf8');

    await new Promise<void>(res => {
      const manProcess = spawn('man', [resolve(__dirname, '../man/marked.1')], options);
      nodeProcess.on('SIGINT', () => {
        manProcess.kill('SIGINT');
      });

      manProcess.on('error', () => {
        console.log(helpText);
      })
        .on('close', () => res());
    });
  }

  async function version(): Promise<void> {
    const pkg = require('../package.json') as { version: string };
    console.log(pkg.version);
  }

  /**
   * Main
   */
  async function start(argv: string[]): Promise<void> {
    const files: string[] = [];
    const options: Record<string, unknown> = {};
    let input: string | undefined;
    let output: string | undefined;
    let string: string | undefined;
    let arg: string;
    let tokens: boolean | undefined;
    let config: string | undefined;
    let opt: string;
    let noclobber: boolean | undefined;

    function getArg(): string {
      let arg = argv.shift();

      if (arg === undefined) {
        return '';
      }

      if (arg.indexOf('--') === 0) {
        // e.g. --opt
        const parts = arg.split('=');
        if (parts.length > 1) {
          // e.g. --opt=val
          argv.unshift(parts.slice(1).join('='));
        }
        arg = parts[0];
      } else if (arg[0] === '-') {
        if (arg.length > 2) {
          // e.g. -abc
          argv = arg.substring(1).split('').map(function(ch) {
            return '-' + ch;
          }).concat(argv);
          arg = argv.shift() ?? '';
        } else {
          // e.g. -a
        }
      } else {
        // e.g. foo
      }

      return arg;
    }

    while (argv.length) {
      arg = getArg();
      switch (arg) {
        case '-o':
        case '--output':
          output = argv.shift();
          break;
        case '-i':
        case '--input':
          input = argv.shift();
          break;
        case '-s':
        case '--string':
          string = argv.shift();
          break;
        case '-t':
        case '--tokens':
          tokens = true;
          break;
        case '-c':
        case '--config':
          config = argv.shift();
          break;
        case '-n':
        case '--no-clobber':
          noclobber = true;
          break;
        case '-h':
        case '--help':
          return await help();
        case '-v':
        case '--version':
          return await version();
        default:
          if (arg.indexOf('--') === 0) {
            opt = camelize(arg.replace(/^--(no-)?/, ''));
            if (!(opt in marked.defaults)) {
              continue;
            }
            const defaultValue = marked.defaults[opt as keyof MarkedOptions];
            if (arg.indexOf('--no-') === 0) {
              options[opt] = typeof defaultValue !== 'boolean'
                ? null
                : false;
            } else {
              options[opt] = typeof defaultValue !== 'boolean'
                ? argv.shift()
                : true;
            }
          } else {
            files.push(arg);
          }
          break;
      }
    }

    async function getData(): Promise<string> {
      if (string) {
        return string;
      }
      if (input) {
        return await readFile(input, 'utf8');
      }
      const file = files.pop();
      if (file !== undefined) {
        return await readFile(file, 'utf8');
      }
      return await getStdin();
    }

    function resolveFile(file: string): string {
      return resolve(file.replace(/^~/, homedir));
    }

    function fileExists(file: string): Promise<boolean> {
      return access(resolveFile(file)).then(() => true, () => false);
    }

    async function runConfig(file: string): Promise<void> {
      const configFile = resolveFile(file);
      let markedConfig: CliConfig | CliConfigModule;
      try {
        // try require for json
        markedConfig = require(configFile) as CliConfig | CliConfigModule;
      } catch(err) {
        if ((err as ErrnoException).code !== 'ERR_REQUIRE_ESM') {
          throw err;
        }
        // must import esm
        markedConfig = await import(pathToFileURL(configFile).href) as CliConfigModule;
      }

      let resolvedConfig: CliConfig;
      if ('default' in markedConfig && markedConfig.default) {
        resolvedConfig = markedConfig.default;
      } else {
        resolvedConfig = markedConfig as CliConfig;
      }

      if (typeof resolvedConfig === 'function') {
        resolvedConfig(marked);
      } else {
        marked.use(resolvedConfig);
      }
    }

    const data = await getData();

    if (config) {
      if (!await fileExists(config)) {
        throw Error(`Cannot load config file '${config}'`);
      }

      await runConfig(config);
    } else {
      const defaultConfig = [
        '~/.marked.json',
        '~/.marked.js',
        '~/.marked/index.js',
      ];

      for (const configFile of defaultConfig) {
        if (await fileExists(configFile)) {
          await runConfig(configFile);
          break;
        }
      }
    }

    const markedOptions = options as MarkedOptions;
    const html = tokens
      ? JSON.stringify(marked.lexer(data, markedOptions), null, 2)
      : await marked.parse(data, markedOptions);

    if (output) {
      if (noclobber && await fileExists(output)) {
        throw Error('marked: output file \'' + output + '\' already exists, disable the \'-n\' / \'--no-clobber\' flag to overwrite\n');
      }
      return await writeFile(output, html);
    }

    nodeProcess.stdout.write(html + '\n');
  }

  /**
   * Helpers
   */
  function getStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      const stdin = nodeProcess.stdin;
      let buff = '';

      stdin.setEncoding('utf8');

      stdin.on('data', function(data: string) {
        buff += data;
      });

      stdin.on('error', function(err) {
        reject(err);
      });

      stdin.on('end', function() {
        resolve(buff);
      });

      stdin.resume();
    });
  }

  function camelize(text: string): string {
    return text.replace(/(\w)-(\w)/g, function(_, a: string, b: string) {
      return a + b.toUpperCase();
    });
  }

  try {
    await start(nodeProcess.argv.slice(2));
    nodeProcess.exit(0);
  } catch(err) {
    const e = err as ErrnoException;
    if (e.code === 'ENOENT') {
      nodeProcess.stderr.write('marked: ' + e.path + ': No such file or directory');
    } else {
      nodeProcess.stderr.write(e.message);
    }
    return nodeProcess.exit(1);
  }
}
