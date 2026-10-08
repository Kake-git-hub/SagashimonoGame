import { useMemo, useState } from 'react';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  getAppSettings,
  QUIZ_SUBJECTS,
  QUIZ_TRIGGERS,
  QuizSubject,
  saveAppSettings,
} from '../services/appSettingsService';
import {
  AVATARS,
  MAX_AGE,
  MIN_AGE,
  Profile,
  deleteProfile,
  difficultyForAge,
  getCurrentProfile,
  getProfiles,
  quizLevelForAge,
  updateProfile,
} from '../services/profileService';
import { generateParentGate } from '../services/quizService';

interface Props {
  onClose: () => void;
  // プロフィールを変更したら呼ぶ（ホーム画面の表示更新用）
  onProfilesChanged: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'レベル 1（3〜4 さい: かぞえる）',
  2: 'レベル 2（5〜6 さい: 10 までの たしざん・ひらがな）',
  3: 'レベル 3（7〜8 さい: 100 までの けいさん・九九）',
  4: 'レベル 4（9〜10 さい: かけざん・わりざん）',
  5: 'レベル 5（11 さい〜: まぜこぜの けいさん）',
};

/**
 * おうちのひと用の設定画面
 * 子どもが勝手に開かないよう、かけ算の関門を通ってから表示する
 */
export function ParentSettingsScreen({ onClose, onProfilesChanged }: Props) {
  const gate = useMemo(() => generateParentGate(), []);
  const [gateInput, setGateInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [gateError, setGateError] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [profiles, setProfiles] = useState<Profile[]>(() => getProfiles());
  const currentId = getCurrentProfile()?.id ?? null;

  const update = (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveAppSettings(next);
      return next;
    });
  };

  const refreshProfiles = () => {
    setProfiles(getProfiles());
    onProfilesChanged();
  };

  const handleGate = () => {
    if (Number(gateInput) === gate.answer) {
      setUnlocked(true);
    } else {
      setGateError(true);
      setGateInput('');
    }
  };

  if (!unlocked) {
    return (
      <div style={styles.container}>
        <div style={styles.gateCard}>
          <h1 style={styles.title}>🔒 おうちのひとへ</h1>
          <p style={styles.lead}>こたえを入力すると設定画面が開きます</p>
          <p style={styles.gatePrompt}>{gate.prompt}</p>
          <input
            type="number"
            inputMode="numeric"
            value={gateInput}
            onChange={e => { setGateInput(e.target.value); setGateError(false); }}
            onKeyDown={e => { if (e.key === 'Enter') handleGate(); }}
            style={styles.gateInput}
            aria-label="こたえ"
            autoFocus
          />
          {gateError && <p style={styles.gateError}>ちがいます</p>}
          <div style={styles.buttons}>
            <button onClick={handleGate} style={styles.primaryButton}>ひらく</button>
            <button onClick={onClose} style={styles.secondaryButton}>もどる</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={onClose} style={styles.backButton} aria-label="ホームへもどる">←</button>
        <h1 style={styles.title}>⚙️ おうちのひと設定</h1>
      </header>

      <div style={styles.scroll}>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>👤 プロフィール（年齢ごとの難易度）</h2>
          <p style={styles.note}>
            年齢に合わせて、ネジはずしの「おきば」の数とクイズのレベルが変わります。進捗はプロフィールごとに分かれて保存されます。
          </p>
          {profiles.map(p => {
            const diff = difficultyForAge(p.age);
            return (
              <div key={p.id} style={styles.profileRow}>
                <select
                  value={p.avatar}
                  onChange={e => { updateProfile(p.id, { avatar: e.target.value }); refreshProfiles(); }}
                  style={styles.avatarSelect}
                  aria-label="アイコン"
                >
                  {AVATARS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input
                  value={p.name}
                  onChange={e => { updateProfile(p.id, { name: e.target.value }); refreshProfiles(); }}
                  style={styles.nameInput}
                  aria-label="なまえ"
                  maxLength={12}
                />
                <select
                  value={p.age}
                  onChange={e => { updateProfile(p.id, { age: Number(e.target.value) }); refreshProfiles(); }}
                  style={styles.ageSelect}
                  aria-label="年齢"
                >
                  {Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i).map(a => (
                    <option key={a} value={a}>{a} さい</option>
                  ))}
                </select>
                <span style={styles.profileMeta}>
                  {diff.label} / クイズ Lv{diff.quizLevel}{p.id === currentId ? ' / 使用中' : ''}
                </span>
                <button
                  onClick={() => {
                    if (profiles.length <= 1) return;
                    if (!window.confirm(`「${p.name}」のプロフィールと進捗を消しますか？`)) return;
                    deleteProfile(p.id);
                    refreshProfiles();
                  }}
                  disabled={profiles.length <= 1}
                  style={styles.deleteButton}
                >
                  削除
                </button>
              </div>
            );
          })}
          <p style={styles.note}>新しいプロフィールはホーム画面の名前をタップして「あたらしく つくる」から追加できます。</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>✏️ べんきょうクイズ</h2>
          <label style={styles.toggleRow}>
            <input
              type="checkbox"
              checked={settings.quizEnabled}
              onChange={e => update({ quizEnabled: e.target.checked })}
            />
            <span>クイズを出す（オフにすると、下の場面でもクイズなしで進めます）</span>
          </label>

          <h3 style={styles.subTitle}>クイズを出す場面</h3>
          {QUIZ_TRIGGERS.map(t => (
            <label key={t.id} style={{ ...styles.toggleRow, opacity: settings.quizEnabled ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={settings.quizTriggers[t.id]}
                disabled={!settings.quizEnabled}
                onChange={e => update({ quizTriggers: { ...settings.quizTriggers, [t.id]: e.target.checked } })}
              />
              <span>{t.label} <small style={styles.small}>（{t.detail}）</small></span>
            </label>
          ))}

          <h3 style={styles.subTitle}>レベル</h3>
          <select
            value={settings.quizLevelOverride ?? 0}
            onChange={e => update({ quizLevelOverride: Number(e.target.value) === 0 ? null : Number(e.target.value) })}
            style={styles.select}
            aria-label="クイズのレベル"
          >
            <option value={0}>
              年齢から自動（使用中のプロフィール: Lv{quizLevelForAge(getCurrentProfile()?.age ?? 6)}）
            </option>
            {[1, 2, 3, 4, 5].map(lv => <option key={lv} value={lv}>{LEVEL_LABELS[lv]}</option>)}
          </select>

          <h3 style={styles.subTitle}>1 回に正解が必要な問題数</h3>
          <div style={styles.radioRow}>
            {[1, 2, 3].map(n => (
              <label key={n} style={styles.radio}>
                <input
                  type="radio"
                  name="quizQuestions"
                  checked={settings.quizQuestions === n}
                  onChange={() => update({ quizQuestions: n })}
                />
                {n} 問
              </label>
            ))}
          </div>

          <h3 style={styles.subTitle}>科目（何も選ばないとレベルに合わせて自動）</h3>
          <div style={styles.subjectGrid}>
            {QUIZ_SUBJECTS.map(s => {
              const checked = settings.quizSubjects.includes(s.id);
              return (
                <label key={s.id} style={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => {
                      const next: QuizSubject[] = e.target.checked
                        ? [...settings.quizSubjects, s.id]
                        : settings.quizSubjects.filter(id => id !== s.id);
                      update({ quizSubjects: next });
                    }}
                  />
                  <span>{s.label} <small style={styles.small}>（Lv{s.minLevel}〜）</small></span>
                </label>
              );
            })}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🔩 ネジはずしの おたすけ</h2>
          <p style={styles.note}>1 ステージの中で「＋はこ」「＋おきば」を使える回数。</p>
          <div style={styles.radioRow}>
            <span>＋はこ:</span>
            {[0, 1, 2, 3].map(n => (
              <label key={n} style={styles.radio}>
                <input type="radio" name="maxBoxes" checked={settings.nejiMaxExtraBoxes === n} onChange={() => update({ nejiMaxExtraBoxes: n })} />
                {n} 回
              </label>
            ))}
          </div>
          <div style={styles.radioRow}>
            <span>＋おきば:</span>
            {[0, 1, 2, 3, 5].map(n => (
              <label key={n} style={styles.radio}>
                <input type="radio" name="maxBuffer" checked={settings.nejiMaxExtraBuffer === n} onChange={() => update({ nejiMaxExtraBuffer: n })} />
                {n} 回
              </label>
            ))}
          </div>
        </section>

        <button
          onClick={() => { saveAppSettings(DEFAULT_SETTINGS); setSettings(getAppSettings()); }}
          style={styles.secondaryButton}
        >
          設定を初期値に戻す
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 10px',
    flexShrink: 0,
    backgroundColor: 'white',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  },
  backButton: {
    padding: '4px 8px',
    fontSize: '1.6rem',
    lineHeight: 1,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#333',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    color: '#333',
  },
  lead: {
    color: '#666',
    margin: '6px 0 14px',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 16px calc(30px + env(safe-area-inset-bottom, 0px))',
    maxWidth: '760px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    WebkitOverflowScrolling: 'touch',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '14px 16px',
    marginBottom: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    margin: '0 0 8px',
    fontSize: '1.1rem',
    color: '#333',
  },
  subTitle: {
    margin: '14px 0 6px',
    fontSize: '0.95rem',
    color: '#555',
  },
  note: {
    margin: '0 0 8px',
    fontSize: '0.85rem',
    color: '#777',
    lineHeight: 1.5,
  },
  small: {
    color: '#999',
    fontWeight: 'normal',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    fontSize: '0.95rem',
    color: '#333',
    cursor: 'pointer',
  },
  radioRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '14px',
    padding: '4px 0',
    fontSize: '0.95rem',
  },
  radio: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
  },
  select: {
    width: '100%',
    padding: '8px',
    fontSize: '0.95rem',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontFamily: 'inherit',
  },
  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },
  profileRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    borderBottom: '1px solid #eee',
  },
  avatarSelect: {
    fontSize: '1.3rem',
    padding: '4px',
    borderRadius: '8px',
    border: '1px solid #ccc',
  },
  nameInput: {
    flex: '1 1 100px',
    minWidth: '90px',
    padding: '8px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontFamily: 'inherit',
  },
  ageSelect: {
    padding: '8px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontFamily: 'inherit',
  },
  profileMeta: {
    fontSize: '0.8rem',
    color: '#777',
  },
  deleteButton: {
    padding: '6px 10px',
    fontSize: '0.85rem',
    backgroundColor: '#fbe9e7',
    color: '#c62828',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  gateCard: {
    margin: 'auto',
    width: 'calc(100% - 32px)',
    maxWidth: '380px',
    backgroundColor: 'white',
    borderRadius: '24px',
    padding: '28px 22px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
  },
  gatePrompt: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px',
  },
  gateInput: {
    width: '140px',
    padding: '10px',
    fontSize: '1.5rem',
    textAlign: 'center',
    borderRadius: '12px',
    border: '2px solid #ccc',
    fontFamily: 'inherit',
  },
  gateError: {
    color: '#c62828',
    margin: '8px 0 0',
    fontWeight: 'bold',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '18px',
  },
  primaryButton: {
    padding: '12px 24px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryButton: {
    padding: '10px 20px',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    backgroundColor: '#e8e8e8',
    color: '#333',
    border: 'none',
    borderRadius: '24px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
