import { useEffect, useRef, useState } from 'react';
import { getStoredGitHubToken, storeGitHubToken, uploadDebugLog } from '../services/githubService';
import { clearDebugLog, debugLog, formatDebugLog, getDebugEntries, getPreviousCrash, subscribeDebugLog } from '../services/debugLogService';

interface Props {
  onClose: () => void;
}

/**
 * デバッグ画面（開発用。おうちのひと向け）
 * 端末に残した記録（debugLogService）を見る・コピーする・送る。落ちたあとに開き直して、落ちる直前の記録を確かめるのに使う
 */
export function DebugPanel({ onClose }: Props) {
  const [text, setText] = useState(() => formatDebugLog());
  const [note, setNote] = useState('');
  const preRef = useRef<HTMLPreElement | null>(null);
  const crash = getPreviousCrash();

  useEffect(() => subscribeDebugLog(() => setText(formatDebugLog())), []);
  // 新しい記録が下に足されるので、いちばん下を見せる
  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote('コピーしました');
    } catch {
      // クリップボードが使えないとき: 文字を選んだ状態にして、手でコピーできるようにする
      const el = preRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setNote('えらんだ ところを コピーしてね');
    }
  };

  // リポジトリの debug-logs ブランチに保存する（開発者がそこから読む）。パズルのアップロードと同じトークンを使う
  const [uploading, setUploading] = useState(false);
  const upload = async () => {
    if (uploading) return;
    let token = getStoredGitHubToken();
    if (!token) {
      const typed = prompt('GitHub の Personal Access Token (PAT) を はりつけてください。\n（Contents: Read and write の けんげんが ひつようです。この たんまつに ほぞんされ、つぎからは きかれません）');
      if (!typed || !typed.trim()) return;
      // すぐ保存する（確かめに失敗しても聞き直さない。本当に使えないトークンだったときだけ、下で消す）
      storeGitHubToken(typed);
      token = getStoredGitHubToken() ?? typed;
    }
    setUploading(true);
    setNote('リポジトリに ほぞんちゅう…');
    const result = await uploadDebugLog(token, formatDebugLog(), 'manual');
    setUploading(false);
    if (result.success) {
      debugLog('app', 'ログを リポジトリに ほぞんした', result.message);
      setNote(`✅ ほぞんしました: ${result.message}`);
      return;
    }
    // うまくいかなかった理由も記録に残す（次に保存できたときに、開発者が読める）
    debugLog('app', 'リポジトリへの ほぞん しっぱい', result.message);
    if (result.reason === 'unauthorized') {
      storeGitHubToken(null);
      setNote(`❌ ほぞんできませんでした。トークンが まちがっているか、きげんが きれています（${result.message}）。もういちど おして いれなおしてね`);
    } else if (result.reason === 'forbidden') {
      setNote(`❌ ほぞんできませんでした。トークンの けんげんが たりません（${result.message}）。GitHub で、この リポジトリを えらんで Contents を Read and write に してね`);
    } else {
      setNote(`❌ ほぞんできませんでした（${result.message}）。ネットを かくにんしてね`);
    }
  };

  // 入れてあるトークンを消す（入れ直したいとき）
  const forgetToken = () => {
    storeGitHubToken(null);
    setNote('トークンを けしました');
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'あそびひろば デバッグログ', text });
    } catch {
      // やめた / 使えない
    }
  };

  return (
    <div style={styles.backdrop} role="dialog" aria-label="デバッグ">
      <div style={styles.panel}>
        <div style={styles.header}>
          <strong style={{ flex: 1 }}>🐞 デバッグ（かいはつよう）</strong>
          <button style={styles.button} onClick={onClose}>とじる</button>
        </div>
        {crash && (
          <p style={styles.crash}>
            ⚠ まえの かいは とちゅうで おわりました（おちた かも）。さいごの きろく: [{crash.tag}] {crash.message}
          </p>
        )}
        <pre ref={preRef} style={styles.log} data-testid="debug-log">{text}</pre>
        <div style={styles.row}>
          <button style={{ ...styles.button, ...styles.primary }} onClick={upload} disabled={uploading}>☁️ リポジトリに ほぞん</button>
          <button style={styles.button} onClick={copy}>📋 コピー</button>
          {typeof navigator.share === 'function' && <button style={styles.button} onClick={share}>📤 おくる</button>}
          <button style={styles.button} onClick={() => { clearDebugLog(); setNote('けしました'); }}>🧹 けす</button>
          {getStoredGitHubToken() && <button style={styles.button} onClick={forgetToken}>🔑 トークンを けす</button>}
        </div>
        <p style={styles.result} role="status" data-testid="debug-note">{note || `${getDebugEntries().length} けん`}</p>
        <p style={styles.help}>きろくは この たんまつの なかに あります。「リポジトリに ほぞん」「コピー」「おくる」を おしたときと、おちた あとの じどうほぞん（トークンを いれてある ときだけ）で そとに でます。</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0, 0, 0, 0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'calc(8px + env(safe-area-inset-top, 0px)) 8px calc(8px + env(safe-area-inset-bottom, 0px))',
  },
  panel: {
    width: '100%', maxWidth: 760, maxHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8,
    background: '#fff', color: '#222', borderRadius: 14, padding: 12, boxSizing: 'border-box',
  },
  header: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' },
  crash: { margin: 0, padding: '8px 10px', borderRadius: 8, background: '#fdecea', color: '#b71c1c', fontSize: '0.85rem', lineHeight: 1.5, wordBreak: 'break-all' },
  log: {
    flex: 1, minHeight: 160, margin: 0, padding: 8, overflow: 'auto', background: '#111', color: '#b2ff59', borderRadius: 8,
    fontSize: '11px', lineHeight: 1.45, fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    WebkitUserSelect: 'text', userSelect: 'text', WebkitOverflowScrolling: 'touch',
  },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: {
    padding: '8px 12px', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: 'inherit', border: '1px solid #bbb', borderRadius: 10,
    background: '#f5f5f5', color: '#222', cursor: 'pointer',
  },
  primary: { background: '#4a90d9', color: '#fff', borderColor: '#4a90d9' },
  result: { margin: 0, fontSize: '0.9rem', fontWeight: 'bold', color: '#333', lineHeight: 1.5, wordBreak: 'break-all' },
  help: { margin: 0, fontSize: '0.75rem', color: '#777', lineHeight: 1.5 },
};
