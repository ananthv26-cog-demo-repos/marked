interface MarkedLike {
  getDefaults?: () => Record<string, unknown>;
  defaults?: Record<string, unknown>;
  lexer: (src: string, options?: unknown) => unknown;
  parser: (tokens: unknown, options?: unknown) => string;
}

interface MarkedModule {
  marked?: MarkedLike;
  default?: MarkedLike;
  lexer?: MarkedLike['lexer'];
  parser?: MarkedLike['parser'];
}

interface MarkedGlobal {
  module?: { exports?: MarkedLike };
  marked?: MarkedLike;
}

interface WorkerRequest {
  id: string;
  task: 'defaults' | 'parse';
  version: string;
  markdown: string;
  options: Record<string, unknown>;
}

const versionCache: Record<string, MarkedLike> = {};
let currentVersion: string;

onunhandledrejection = (e) => {
  throw e.reason;
};

onmessage = function(e: MessageEvent) {
  const data = e.data as WorkerRequest;
  if (data.version === currentVersion) {
    parse(data);
  } else {
    loadVersion(data.version).then(() => {
      parse(data);
    });
  }
};

function getDefaults(): Record<string, unknown> {
  const marked = versionCache[currentVersion];
  let defaults: Record<string, unknown> = {};
  const markedDefaults = marked.defaults;
  if (typeof marked.getDefaults === 'function') {
    defaults = marked.getDefaults();
    delete defaults.renderer;
  } else if (markedDefaults) {
    for (const prop in markedDefaults) {
      if (prop !== 'renderer') {
        defaults[prop] = markedDefaults[prop];
      }
    }
  }
  return defaults;
}

function mergeOptions(options: Record<string, unknown>): Record<string, unknown> {
  const defaults = getDefaults();
  const opts: Record<string, unknown> = {};
  const invalidOptions = [
    'renderer',
    'tokenizer',
    'walkTokens',
    'extensions',
    'highlight',
    'sanitizer',
  ];
  for (const prop in defaults) {
    opts[prop] = invalidOptions.includes(prop) || !(prop in options)
      ? defaults[prop]
      : options[prop];
  }
  return opts;
}

function parse(data: WorkerRequest): void {
  switch (data.task) {
    case 'defaults': {
      postMessage({
        id: data.id,
        task: data.task,
        defaults: getDefaults(),
      });
      break;
    }
    case 'parse': {
      const marked = versionCache[currentVersion];
      // marked 0.0.1 had tokens array as the second parameter of lexer and no options
      const options = currentVersion.endsWith('@0.0.1') ? [] : mergeOptions(data.options);
      const startTime = new Date();
      const lexed = marked.lexer(data.markdown, options);
      const lexedList = jsonString(lexed);
      const parsed = marked.parser(lexed, options);
      const endTime = new Date();
      postMessage({
        id: data.id,
        task: data.task,
        lexed: lexedList,
        parsed,
        time: endTime.getTime() - startTime.getTime(),
      });
      break;
    }
  }
}

function jsonString(input: unknown, level = 0): string {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return '[]';
    }
    const items: string[] = [];
    let i: number;
    if (!Array.isArray(input[0]) && typeof input[0] === 'object' && input[0] !== null) {
      for (i = 0; i < input.length; i++) {
        items.push(' '.repeat(2 * level) + jsonString(input[i], level + 1));
      }
      return '[\n' + items.join('\n') + '\n]';
    }
    for (i = 0; i < input.length; i++) {
      items.push(jsonString(input[i], level));
    }
    return '[' + items.join(', ') + ']';
  } else if (typeof input === 'object' && input !== null) {
    const props: string[] = [];
    const record = input as Record<string, unknown>;
    for (const prop in record) {
      props.push(prop + ':' + jsonString(record[prop], level));
    }
    return '{' + props.join(', ') + '}';
  } else {
    return JSON.stringify(input);
  }
}

function fetchMarked(file: string): () => Promise<MarkedLike | undefined> {
  return () =>
    fetch(file)
      .then((res) => res.text())
      .then((text) => {
        const g = globalThis as unknown as MarkedGlobal;
        g.module = { };
        try {
          // eslint-disable-next-line no-new-func
          Function(text)();
        } catch {
          throw new Error(`Cannot find ${file}`);
        }
        const marked = g.marked || g.module?.exports;
        return marked;
      });
}

function loadVersion(ver: string): Promise<void> {
  let promise: Promise<void>;
  if (versionCache[ver]) {
    promise = Promise.resolve();
  } else {
    promise = import(ver + '/lib/marked.esm.js')
      .catch(fetchMarked(ver + '/marked.min.js'))
      .catch(fetchMarked(ver + '/lib/marked.umd.js'))
      .catch(fetchMarked(ver + '/lib/marked.js'))
      .then((marked: MarkedModule | undefined) => {
        if (!marked) {
          throw Error('No marked');
        } else if (marked.marked) {
          versionCache[ver] = marked.marked;
        } else if (marked.default) {
          versionCache[ver] = marked.default;
        } else if (marked.lexer && marked.parser) {
          versionCache[ver] = marked as MarkedLike;
        } else {
          throw new Error('Cannot find marked');
        }
      });
  }
  return promise.then(() => {
    currentVersion = ver;
  }).catch((err: unknown) => {
    console.error(err);
    throw new Error('Cannot load that version of marked');
  });
}
