import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node には localStorage / window が無いので、最小限のものを用意する
function installBrowser(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const handlers = new Map<string, ((e: unknown) => void)[]>();
  const on = (type: string, fn: (e: unknown) => void) => handlers.set(type, [...(handlers.get(type) ?? []), fn]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  const doc = { visibilityState: 'visible', addEventListener: on };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { userAgent: 'test', hardwareConcurrency: 4, maxTouchPoints: 5, onLine: true });
  vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 2, matchMedia: () => ({ matches: false }), addEventListener: on });
  vi.stubGlobal('__BUILD_TIME__', '2026-11-15T00:00:00.000Z');
  return { store, doc, fire: (type: string, e: unknown = {}) => (handlers.get(type) ?? []).forEach(fn => fn(e)) };
}

async function load() {
  vi.resetModules();
  return import('./debugLogService');
}

describe('debugLogService', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('記録はその場で localStorage に書かれ、開き直しても読める', async () => {
    const env = installBrowser();
    const log = await load();
    log.startDebugLog();
    log.debugLog('makeup', 'カメラ かいし', { w: 960, h: 720 });
    const saved = JSON.parse(env.store.get('asobi_debug_log')!);
    expect(saved[saved.length - 1]).toMatchObject({ tag: 'makeup', m: 'カメラ かいし', d: '{"w":960,"h":720}' });
    expect(log.formatDebugLog()).toContain('[makeup] カメラ かいし {"w":960,"h":720}');
  });

  it('画面を表示したまま終わっていたら、次の起動で「落ちた」と分かり、最後の記録が手がかりになる', async () => {
    const first = installBrowser();
    let log = await load();
    log.startDebugLog();
    log.debugScreen('makeup');
    log.debugLog('makeup', 'さいしょの すいろん まえ');
    log.debugLog('makeup', 'じょうたい', { fps: 20 }, 'beat');
    expect(first.store.get('asobi_debug_alive')).toBe('1');
    // ここで落ちた（pagehide も visibilitychange も来ない）→ 同じ保存内容で開き直す
    installBrowser(Object.fromEntries(first.store));
    log = await load();
    log.startDebugLog();
    // 手がかりは、定期的な状態の記録ではなく最後の「できごと」。どの画面だったかも分かる
    expect(log.getPreviousCrash()).toMatchObject({ tag: 'makeup', message: 'さいしょの すいろん まえ', screen: 'makeup' });
    expect(log.formatDebugLog()).toContain('まえの かいは とちゅうで おわった');
  });

  it('裏に回ってから終わったとき・ふつうに閉じたときは、落ちた扱いにしない', async () => {
    const first = installBrowser();
    let log = await load();
    log.startDebugLog();
    first.doc.visibilityState = 'hidden';
    first.fire('visibilitychange');
    expect(first.store.has('asobi_debug_alive')).toBe(false);
    installBrowser(Object.fromEntries(first.store));
    log = await load();
    log.startDebugLog();
    expect(log.getPreviousCrash()).toBeNull();
  });

  it('同じキーの記録が続いたら上書きし、件数は上限を超えない', async () => {
    installBrowser();
    const log = await load();
    log.startDebugLog();
    const before = log.getDebugEntries().length;
    log.debugLog('makeup', 'じょうたい', { fps: 20 }, 'beat');
    log.debugLog('makeup', 'じょうたい', { fps: 24 }, 'beat');
    expect(log.getDebugEntries().length).toBe(before + 1);
    expect(log.getDebugEntries()[before].d).toBe('{"fps":24}');
    for (let i = 0; i < 400; i++) log.debugLog('app', `n${i}`);
    expect(log.getDebugEntries().length).toBeLessThanOrEqual(220);
    expect(log.getDebugEntries()[log.getDebugEntries().length - 1].m).toBe('n399');
  });

  it('画面で起きたエラーも記録する', async () => {
    const env = installBrowser();
    const log = await load();
    log.startDebugLog();
    env.fire('error', { message: 'boom', filename: 'https://x/assets/a.js', lineno: 3, colno: 9 });
    env.fire('unhandledrejection', { reason: new RangeError('out of memory') });
    const text = log.formatDebugLog();
    expect(text).toContain('[error] boom a.js:3:9');
    expect(text).toContain('RangeError: out of memory');
  });
});
