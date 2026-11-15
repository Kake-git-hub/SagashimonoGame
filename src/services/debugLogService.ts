/**
 * 開発用のデバッグログ（端末の中だけに残す「足あと」）
 *
 * 実機（iPad など）ではブラウザが落ちると何も残らず、原因を調べられない。そこで、要所ごとに短い記録を
 * localStorage へ **その場で** 書いておき、落ちたあとに開き直しても「落ちる直前に何をしていたか」を読めるようにする。
 * - debugLog(tag, message, data): 記録を足す（最大 MAX_ENTRIES 件。古いものから捨てる）
 * - 前の回が「画面を表示したまま」終わっていたら、落ちたものとして覚えておく（getPreviousCrash）
 * - 画面で起きたエラー（error / unhandledrejection）も記録する
 * 記録は端末の外へは出さない。デバッグ画面の「コピー」「おくる」を押したときだけ、文字として取り出せる
 */

const LOG_KEY = 'asobi_debug_log';
const ALIVE_KEY = 'asobi_debug_alive';
const MAX_ENTRIES = 220;

export interface DebugEntry {
  t: number;        // 記録した時刻（Date.now()）
  tag: string;      // どこの記録か（app / makeup / error など）
  m: string;        // 内容
  d?: string;       // 付けた値（JSON にした文字列）
  k?: string;       // 同じ k の記録が続いたら、足さずに上書きする（定期的な状態の記録用）
}

export interface PreviousCrash {
  tag: string;
  message: string;
  at: number;
  screen: string | null;  // そのとき開いていた画面（debugScreen で記録したもの）
}

const SCREEN_PREFIX = 'がめん: ';

// いま開いている画面を記録する（落ちたときに、どの画面だったかが分かる）
export function debugScreen(screen: string): void {
  debugLog('app', `${SCREEN_PREFIX}${screen}`);
}

let entries: DebugEntry[] = [];
let started = false;
let previousCrash: PreviousCrash | null = null;
const listeners = new Set<() => void>();

function read(): DebugEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(e => e && typeof e.t === 'number' && typeof e.m === 'string') : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries));
  } catch {
    // 保存できなくても動作は続ける
  }
}

function setAlive(alive: boolean) {
  try {
    if (alive) localStorage.setItem(ALIVE_KEY, '1');
    else localStorage.removeItem(ALIVE_KEY);
  } catch {
    // 無視
  }
}

function stringify(data: unknown): string | undefined {
  if (data === undefined) return undefined;
  try {
    if (data instanceof Error) return `${data.name}: ${data.message}`;
    const s = typeof data === 'string' ? data : JSON.stringify(data);
    return s.length > 300 ? `${s.slice(0, 300)}…` : s;
  } catch {
    return String(data);
  }
}

/**
 * 記録を足す。落ちる直前の記録が残るよう、毎回すぐ保存する
 * @param replaceKey 同じキーの記録が直前にあれば上書きする（5 秒ごとの状態など、ログを埋めたくないもの）
 */
export function debugLog(tag: string, message: string, data?: unknown, replaceKey?: string): void {
  const entry: DebugEntry = { t: Date.now(), tag, m: message };
  const d = stringify(data);
  if (d !== undefined) entry.d = d;
  if (replaceKey) entry.k = replaceKey;
  const last = entries[entries.length - 1];
  if (replaceKey && last && last.k === replaceKey && last.tag === tag) entries[entries.length - 1] = entry;
  else entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);
  persist();
  listeners.forEach(l => l());
}

function describeEnvironment(): Record<string, unknown> {
  const nav = navigator as Navigator & { deviceMemory?: number; standalone?: boolean };
  return {
    build: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '?',
    ua: nav.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
    cores: nav.hardwareConcurrency,
    memoryGB: nav.deviceMemory,
    touch: nav.maxTouchPoints,
    online: nav.onLine,
  };
}

/**
 * 起動時に 1 回呼ぶ: 前の回の記録を読み、落ちていたかを調べ、エラーの記録を始める
 */
export function startDebugLog(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  entries = read();
  let wasAlive = false;
  try {
    wasAlive = localStorage.getItem(ALIVE_KEY) === '1';
  } catch {
    // 無視
  }
  if (wasAlive) {
    // 定期的な状態の記録（k つき）より前の、最後の「できごと」を落ちた場所として覚える
    const last = [...entries].reverse().find(e => !e.k) ?? entries[entries.length - 1];
    const screenEntry = [...entries].reverse().find(e => e.tag === 'app' && e.m.startsWith(SCREEN_PREFIX));
    if (last) {
      previousCrash = {
        tag: last.tag, message: last.d ? `${last.m} ${last.d}` : last.m, at: last.t,
        screen: screenEntry ? screenEntry.m.slice(SCREEN_PREFIX.length) : null,
      };
    }
    debugLog('app', '⚠ まえの かいは とちゅうで おわった（おちた かも）');
  }
  debugLog('app', '=== きどう ===', describeEnvironment());
  setAlive(document.visibilityState === 'visible');

  // 裏に回っている間に OS に終了させられるのは普通のことなので、落ちた扱いにしない
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    setAlive(visible);
    debugLog('app', visible ? 'まえに もどった' : 'うらに まわった');
  });
  window.addEventListener('pagehide', () => setAlive(false));

  window.addEventListener('error', e => {
    debugLog('error', e.message || 'error', e.filename ? `${e.filename.split('/').pop()}:${e.lineno}:${e.colno}` : undefined);
  });
  window.addEventListener('unhandledrejection', e => {
    debugLog('error', 'unhandledrejection', e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : e.reason);
  });
}

// 前の回が落ちていたら、最後の記録（どこで落ちたかの手がかり）
export function getPreviousCrash(): PreviousCrash | null {
  return previousCrash;
}

export function getDebugEntries(): DebugEntry[] {
  return entries;
}

export function clearDebugLog(): void {
  entries = [];
  previousCrash = null;
  persist();
  debugLog('app', 'ログを けした', describeEnvironment());
}

export function subscribeDebugLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function formatTime(t: number): string {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

// コピーして送れる文字の形にする
export function formatDebugLog(list: DebugEntry[] = entries): string {
  return list.map(e => `${formatTime(e.t)} [${e.tag}] ${e.m}${e.d ? ` ${e.d}` : ''}`).join('\n');
}
