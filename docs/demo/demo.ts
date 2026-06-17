type ThemePreference = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';

interface DemoWorker extends Worker {
  working?: boolean;
  timeout?: ReturnType<typeof setTimeout>;
}

interface WorkerMessage {
  task: string;
  version: string;
  markdown?: string;
  options?: Record<string, unknown>;
  id?: string;
}

interface WorkerResponse {
  id: string;
  task: 'defaults' | 'parse';
  defaults?: Record<string, unknown>;
  parsed?: string;
  lexed?: string;
  time?: number;
}

interface JsdelivrResponse {
  versions: string[];
  tags: { latest: string };
}

onunhandledrejection = (e) => {
  throw e.reason;
};

const $loadingElem = document.querySelector<HTMLElement>('#loading')!;
const $mainElem = document.querySelector<HTMLElement>('#main')!;
const $markdownElem = document.querySelector<HTMLTextAreaElement>('#markdown')!;
const $markedVerElem = document.querySelector<HTMLSelectElement>('#markedVersion')!;
const $optionsElem = document.querySelector<HTMLTextAreaElement>('#options')!;
const $outputTypeElem = document.querySelector<HTMLSelectElement>('#outputType')!;
const $inputTypeElem = document.querySelector<HTMLSelectElement>('#inputType')!;
const $responseTimeElem = document.querySelector<HTMLElement>('#responseTime')!;
const $previewElem = document.querySelector<HTMLElement>('#preview')!;
const $previewIframe = document.querySelector<HTMLIFrameElement>('#preview iframe')!;
const $permalinkElem = document.querySelector<HTMLAnchorElement>('#permalink')!;
const $clearElem = document.querySelector<HTMLElement>('#clear')!;
const $htmlElem = document.querySelector<HTMLTextAreaElement>('#html')!;
const $lexerElem = document.querySelector<HTMLTextAreaElement>('#lexer')!;
const $panes = Array.from(document.querySelectorAll<HTMLElement>('.pane'));
const $inputPanes = Array.from(document.querySelectorAll<HTMLElement>('.inputPane'));
let lastInput = '';
let inputDirty = true;
let $activeOutputElem: HTMLElement | null = null;
let latestVersion = 'master';
const search = searchToObject();
const markedVersions: Record<string, string> = {
  master: '../',
};
let delayTime = 1;
let checkChangeTimeout: number | undefined;
let markedWorker: DemoWorker | undefined;

$previewIframe.addEventListener('load', handleIframeLoad);

$outputTypeElem.addEventListener('change', handleOutputChange, false);

$inputTypeElem.addEventListener('change', handleInputChange, false);

$markedVerElem.addEventListener('change', handleVersionChange, false);

$markdownElem.addEventListener('change', handleInput, false);
$markdownElem.addEventListener('keyup', handleInput, false);
$markdownElem.addEventListener('keypress', handleInput, false);
$markdownElem.addEventListener('keydown', handleInput, false);

$optionsElem.addEventListener('change', handleInput, false);
$optionsElem.addEventListener('keyup', handleInput, false);
$optionsElem.addEventListener('keypress', handleInput, false);
$optionsElem.addEventListener('keydown', handleInput, false);

$clearElem.addEventListener('click', handleClearClick, false);

// --- Theme Toggle Setup ---
const $themeToggle = document.getElementById('theme-toggle');
const $themeToggleIcon = $themeToggle ? $themeToggle.querySelector('[data-theme-icon]') : null;
const $themeToggleText = $themeToggle ? $themeToggle.querySelector('[data-theme-text]') : null;

const THEME_STORAGE_KEY = 'theme-preference';
const LEGACY_STORAGE_KEY = 'theme';
const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const TOGGLE_UI: Record<ThemePreference, { icon: string; text: string }> = {
  system: { icon: 'brightness_auto', text: 'System' },
  light: { icon: 'light_mode', text: 'Light' },
  dark: { icon: 'dark_mode', text: 'Dark' },
};

function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  document.documentElement.setAttribute('data-theme', theme);

  try {
    if ($previewIframe && $previewIframe.contentDocument) {
      if (theme === 'dark') {
        $previewIframe.contentDocument.documentElement.classList.add('dark');
      } else {
        $previewIframe.contentDocument.documentElement.classList.remove('dark');
      }
    }
  } catch {
    // Ignore cross-origin errors
  }
}

function getSystemTheme(): Theme {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function sanitisePreference(value: string | null): ThemePreference | null {
  return value === 'system' || value === 'light' || value === 'dark' ? value : null;
}

function readStoredPreference(): ThemePreference | null {
  try {
    const stored = sanitisePreference(localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) {
      return stored;
    }
    return sanitisePreference(localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    if (preference === 'light' || preference === 'dark') {
      localStorage.setItem(LEGACY_STORAGE_KEY, preference);
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // Storage might be unavailable; ignore
  }
}

function getEffectiveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function updateToggle(preference: ThemePreference): void {
  if (!$themeToggle) {
    return;
  }
  const details = TOGGLE_UI[preference] || TOGGLE_UI.system;
  if ($themeToggleIcon) {
    $themeToggleIcon.textContent = details.icon;
  }
  if ($themeToggleText) {
    $themeToggleText.textContent = details.text;
  }
  $themeToggle.setAttribute('data-theme-mode', preference);
  const label = `Switch theme (current: ${details.text})`;
  $themeToggle.setAttribute('aria-label', label);
  $themeToggle.title = label;
}

let currentPreference: ThemePreference = readStoredPreference() || 'system';

function applyPreference(preference: ThemePreference, persist: boolean): void {
  currentPreference = preference;
  const effectiveTheme = getEffectiveTheme(preference);
  applyTheme(effectiveTheme);
  document.documentElement.setAttribute('data-theme-preference', preference);
  updateToggle(preference);
  if (persist) {
    writeStoredPreference(preference);
  }
}

applyPreference(currentPreference, true);

if ($themeToggle) {
  $themeToggle.addEventListener('click', function() {
    const index = THEME_ORDER.indexOf(currentPreference);
    const nextIndex = (index + 1) % THEME_ORDER.length;
    const nextPreference = THEME_ORDER[nextIndex];
    applyPreference(nextPreference, true);
  });
}

const systemMatcher = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
if (systemMatcher) {
  const handleSystemChange = function(): void {
    if (currentPreference === 'system') {
      applyPreference('system', false);
    }
  };

  if (typeof systemMatcher.addEventListener === 'function') {
    systemMatcher.addEventListener('change', handleSystemChange);
  } else if (typeof systemMatcher.addListener === 'function') {
    systemMatcher.addListener(handleSystemChange);
  }
}

Promise.all([
  setInitialQuickref(),
  setInitialOutputType(),
  setInitialText(),
  setInitialVersion().then(setInitialOptions),
])
  .then(() => {
    handleInputChange();
    handleOutputChange();
    checkForChanges();
    setScrollPercent(0);
    $loadingElem.style.display = 'none';
    $mainElem.style.display = 'block';
  })
  .catch(() => {
    $loadingElem.classList.add('loadingError');
    $loadingElem.textContent =
      'Failed to load marked. Refresh the page to try again.';
  });

function setInitialText(): Promise<void> | void {
  if ('text' in search) {
    $markdownElem.value = search.text;
  } else {
    return fetch('./initial.md')
      .then((res) => res.text())
      .then((text) => {
        if ($markdownElem.value === '') {
          $markdownElem.value = text;
        }
      });
  }
}

function setInitialQuickref(): Promise<void> {
  return fetch('./quickref.md')
    .then((res) => res.text())
    .then((text) => {
      document.querySelector<HTMLTextAreaElement>('#quickref')!.value = text;
    });
}

function setInitialVersion(): Promise<void> {
  return fetch('https://data.jsdelivr.com/v1/package/npm/marked')
    .then((res) => res.json())
    .then((json: JsdelivrResponse) => {
      for (const ver of json.versions) {
        markedVersions[ver] = 'https://cdn.jsdelivr.net/npm/marked@' + ver;
        const opt = document.createElement('option');
        opt.textContent = ver;
        opt.value = ver;
        $markedVerElem.appendChild(opt);
      }

      if (location.host === 'marked.js.org') {
        latestVersion = json.tags.latest;
      } else {
        const masterOption = $markedVerElem.querySelector('option[value="master"]');
        if (masterOption) {
          masterOption.textContent = 'This Build';
        }
      }

      if (search.version && markedVersions[search.version]) {
        $markedVerElem.value = search.version;
        return;
      }

      $markedVerElem.value = latestVersion;
    })
    .then(updateVersion);
}

function setInitialOptions(): Promise<void> | void {
  if ('options' in search) {
    $optionsElem.value = search.options;
  } else {
    return setDefaultOptions();
  }
}

function setInitialOutputType(): void {
  if (search.outputType) {
    $outputTypeElem.value = search.outputType;
  }
}

function handleIframeLoad(): void {
  lastInput = '';
  inputDirty = true;

  // Apply current theme to the iframe
  try {
    const currentTheme = document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
    if ($previewIframe && $previewIframe.contentDocument) {
      if (currentTheme === 'dark') {
        $previewIframe.contentDocument.documentElement.classList.add('dark');
      } else {
        $previewIframe.contentDocument.documentElement.classList.remove('dark');
      }
    }
  } catch {
    // Ignore cross-origin errors
  }
}

function handleInput(): void {
  inputDirty = true;
}

function handleVersionChange(): void {
  updateVersion();
}

function handleClearClick(): void {
  $markdownElem.value = '';
  $markedVerElem.value = latestVersion;
  updateVersion();
  setDefaultOptions();
}

function handleInputChange(): void {
  handleChange($inputPanes, $inputTypeElem.value);
}

function handleOutputChange(): void {
  $activeOutputElem = handleChange($panes, $outputTypeElem.value);
  updateLink();
}

function handleChange(panes: HTMLElement[], visiblePane: string): HTMLElement | null {
  let active: HTMLElement | null = null;
  for (let i = 0; i < panes.length; i++) {
    if (panes[i].id === visiblePane) {
      panes[i].style.display = '';
      active = panes[i];
    } else {
      panes[i].style.display = 'none';
    }
  }
  return active;
}

function setDefaultOptions(): Promise<void> {
  return messageWorker({
    task: 'defaults',
    version: markedVersions[$markedVerElem.value],
  });
}

function setOptions(opts: unknown): void {
  $optionsElem.value = JSON.stringify(
    opts,
    (key, value) => {
      if (value !== null
        && typeof value === 'object'
        && Object.getPrototypeOf(value) !== Object.prototype
      ) {
        return undefined;
      }
      return value;
    },
    ' ',
  );
}

function searchToObject(): Record<string, string> {
  // modified from https://stackoverflow.com/a/7090123/806777
  const pairs = location.search.slice(1).split('&');
  const obj: Record<string, string> = {};

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i] === '') {
      continue;
    }

    const pair = pairs[i].split('=');

    obj[decodeURIComponent(pair.shift() ?? '')] = decodeURIComponent(pair.join('='));
  }

  return obj;
}

function getScrollSize(): number {
  if (!$activeOutputElem) {
    return 0;
  }

  const e = $activeOutputElem;

  return e.scrollHeight - e.clientHeight;
}

function getScrollPercent(): number {
  if (!$activeOutputElem) {
    return 1;
  }

  const size = getScrollSize();

  if (size <= 0) {
    return 1;
  }

  return $activeOutputElem.scrollTop / size;
}

function setScrollPercent(percent: number): void {
  if ($activeOutputElem) {
    $activeOutputElem.scrollTop = percent * getScrollSize();
  }
}

function updateLink(): void {
  let outputType = '';
  if ($outputTypeElem.value !== 'preview') {
    outputType = 'outputType='
      + $outputTypeElem.value
      + '&';
  }

  $permalinkElem.href = '?'
    + outputType
    + 'text='
    + encodeURIComponent($markdownElem.value)
    + '&options='
    + encodeURIComponent($optionsElem.value)
    + '&version='
    + encodeURIComponent($markedVerElem.value);
  history.replaceState('', document.title, $permalinkElem.href);
}

function updateVersion(): void {
  handleInput();
}

function checkForChanges(): void {
  if (inputDirty && $markedVerElem.value !== 'pr') {
    inputDirty = false;

    updateLink();

    let options: Record<string, unknown> = {};
    const optionsString = $optionsElem.value || '{}';
    try {
      const newOptions = JSON.parse(optionsString) as Record<string, unknown>;
      options = newOptions;
      $optionsElem.classList.remove('error');
    } catch {
      $optionsElem.classList.add('error');
    }

    const version = markedVersions[$markedVerElem.value];
    const markdown = $markdownElem.value;
    const hash = version + markdown + optionsString;
    if (lastInput !== hash) {
      lastInput = hash;
      delayTime = 100;
      messageWorker({
        task: 'parse',
        version,
        markdown,
        options,
      });
    }
  }
  checkChangeTimeout = window.setTimeout(checkForChanges, delayTime);
}

function setResponseTime(ms: number): void {
  let amount: number | string = ms;
  let suffix = 'ms';
  if (ms > 1000 * 60 * 60) {
    amount = 'Too Long';
    suffix = '';
  } else if (ms > 1000 * 60) {
    amount = '>'
      + Math.floor(ms / (1000 * 60));
    suffix = 'm';
  } else if (ms > 1000) {
    amount = '>'
      + Math.floor(ms / 1000);
    suffix = 's';
  }
  $responseTimeElem.textContent = amount + suffix;
  $responseTimeElem.animate(
    [{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }],
    200,
  );
}

function setParsed(parsed: string, lexed: string): void {
  try {
    $previewIframe.contentDocument!.body!.innerHTML = parsed;
  } catch {}
  $htmlElem.value = parsed;
  $lexerElem.value = lexed;
}

const workerPromises: Record<string, () => void> = {};
function messageWorker(message: WorkerMessage): Promise<void> {
  if (!markedWorker || markedWorker.working) {
    if (markedWorker) {
      clearTimeout(markedWorker.timeout);
      markedWorker.terminate();
    }
    markedWorker = new Worker('worker.js');
    markedWorker.onmessage = (e: MessageEvent) => {
      const response = e.data as WorkerResponse;
      clearTimeout(markedWorker?.timeout);
      if (markedWorker) {
        markedWorker.working = false;
      }
      switch (response.task) {
        case 'defaults': {
          setOptions(response.defaults);
          break;
        }
        case 'parse': {
          $previewElem.classList.remove('error');
          $htmlElem.classList.remove('error');
          $lexerElem.classList.remove('error');
          const scrollPercent = getScrollPercent();
          setParsed(response.parsed ?? '', response.lexed ?? '');
          setScrollPercent(scrollPercent);
          setResponseTime(response.time ?? 0);
          break;
        }
      }
      clearTimeout(checkChangeTimeout);
      delayTime = 10;
      checkForChanges();
      workerPromises[response.id]();
      delete workerPromises[response.id];
    };
    markedWorker.onerror = markedWorker.onmessageerror = handleWorkerError;
  }
  if (message.task !== 'defaults') {
    if (markedWorker) {
      markedWorker.working = true;
    }
    workerTimeout(0);
  }
  return new Promise<void>((resolve) => {
    message.id = uniqueWorkerMessageId();
    workerPromises[message.id] = resolve;
    markedWorker?.postMessage(message);
  });
}

function handleWorkerError(err: ErrorEvent | MessageEvent | string): void {
  if (markedWorker) {
    clearTimeout(markedWorker.timeout);
  }
  let error = 'There was an error in the Worker';
  if (err) {
    if (typeof err === 'string') {
      error = err;
    } else if ('message' in err && err.message) {
      error = err.message;
    }
  }
  error = error.replace(/^Uncaught Error: /, '');
  $previewElem.classList.add('error');
  $htmlElem.classList.add('error');
  $lexerElem.classList.add('error');
  setParsed(error, error);
  setScrollPercent(0);
}

function uniqueWorkerMessageId(): string {
  let id: string;
  do {
    id = Math.random().toString(36);
  } while (id in workerPromises);
  return id;
}

function workerTimeout(seconds: number): void {
  if (!markedWorker) {
    return;
  }
  markedWorker.timeout = setTimeout(() => {
    seconds++;
    handleWorkerError(
      'Marked has taken longer than '
        + seconds
        + ' second'
        + (seconds > 1 ? 's' : '')
        + ' to respond...',
    );
    workerTimeout(seconds);
  }, 1000);
}
