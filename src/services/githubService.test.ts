import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_LOG_BRANCH, debugLogPath, uploadDebugLog } from './githubService';

interface Call { url: string; method: string; body: Record<string, unknown> | null }

function mockFetch(handler: (call: Call) => { status: number; json?: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const call = { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null };
    calls.push(call);
    const res = handler(call);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.json ?? {} };
  });
  return calls;
}

describe('uploadDebugLog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ファイル名は時刻順に並ぶ', () => {
    expect(debugLogPath(new Date(Date.UTC(2026, 10, 15, 3, 4, 5)))).toBe('debug-logs/20261115-030405.txt');
  });

  it('ブランチが無ければ main から作り、main ではなく debug-logs ブランチへ保存する（デプロイを走らせない）', async () => {
    const calls = mockFetch(call => {
      if (call.url.endsWith(`/git/ref/heads/${DEBUG_LOG_BRANCH}`)) return { status: 404 };
      if (call.url.endsWith('/git/ref/heads/main')) return { status: 200, json: { object: { sha: 'abc123' } } };
      if (call.url.endsWith('/git/refs')) return { status: 201 };
      return { status: 201 };
    });
    const result = await uploadDebugLog('token', '12:00:00.000 [app] きどう', 'manual');
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/^debug-logs\/\d{8}-\d{6}\.txt$/);
    expect(calls[2]).toMatchObject({ method: 'POST', body: { ref: 'refs/heads/debug-logs', sha: 'abc123' } });
    const put = calls[3];
    expect(put.method).toBe('PUT');
    expect(put.url).toContain('/contents/debug-logs/');
    expect(put.body?.branch).toBe('debug-logs');
    // 中身は日本語のまま戻せる
    expect(new TextDecoder().decode(Uint8Array.from(atob(String(put.body?.content)), c => c.charCodeAt(0)))).toBe('12:00:00.000 [app] きどう');
  });

  it('ブランチがあれば作らずに保存する。トークンが無効なら unauthorized を返す', async () => {
    let calls = mockFetch(() => ({ status: 200 }));
    expect((await uploadDebugLog('token', 'x')).success).toBe(true);
    expect(calls.map(c => c.method)).toEqual(['GET', 'PUT']);
    calls = mockFetch(call => (call.method === 'PUT' ? { status: 401 } : { status: 200 }));
    expect(await uploadDebugLog('bad', 'x')).toMatchObject({ success: false, reason: 'unauthorized' });
  });

  it('どの段階で失敗したかと理由を返す（最初の確認で 401 = トークンが違う、ブランチ作成で 403 = 権限が足りない）', async () => {
    mockFetch(() => ({ status: 401 }));
    expect(await uploadDebugLog('bad', 'x')).toMatchObject({ success: false, reason: 'unauthorized', message: 'ブランチの かくにん: GitHub 401' });
    mockFetch(call => {
      if (call.url.endsWith(`/git/ref/heads/${DEBUG_LOG_BRANCH}`)) return { status: 404 };
      if (call.url.endsWith('/git/ref/heads/main')) return { status: 200, json: { object: { sha: 'abc' } } };
      return { status: 403 };
    });
    expect(await uploadDebugLog('weak', 'x')).toMatchObject({ success: false, reason: 'forbidden', message: 'ブランチを つくる: GitHub 403' });
  });

  it('貼り付けたトークンに混ざった空白・改行は取り除いて使う', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>).Authorization);
      return { ok: true, status: 200, json: async () => ({}) };
    });
    await uploadDebugLog('  github_pat_abc\n', 'x');
    expect(seen.every(h => h === 'Bearer github_pat_abc')).toBe(true);
  });
});
