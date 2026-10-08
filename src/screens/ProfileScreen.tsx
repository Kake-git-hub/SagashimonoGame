import { useState } from 'react';
import { AVATARS, MAX_AGE, MIN_AGE, Profile, createProfile, setCurrentProfile } from '../services/profileService';

interface Props {
  profiles: Profile[];
  // 選択またはプロフィール作成が終わった
  onDone: (profile: Profile) => void;
  // 戻る（最初のプロフィール作成時は無し）
  onCancel?: () => void;
}

/**
 * だれが あそぶ？ / なんさい？
 * 初回起動時はプロフィール作成、2 人以上いるときは選択画面になる
 */
export function ProfileScreen({ profiles, onDone, onCancel }: Props) {
  const [creating, setCreating] = useState(profiles.length === 0);
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [avatar, setAvatar] = useState(AVATARS[profiles.length % AVATARS.length]);

  const handleSelect = (profile: Profile) => {
    setCurrentProfile(profile.id);
    onDone(profile);
  };

  const handleCreate = () => {
    if (age === null) return;
    const profile = createProfile({ name, age, avatar });
    onDone(profile);
  };

  if (creating) {
    const ages = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>👋 はじめまして！</h1>
          <p style={styles.lead}>なまえと なんさいか おしえてね</p>

          <div style={styles.avatarRow}>
            {AVATARS.map(a => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                style={{ ...styles.avatarButton, ...(a === avatar ? styles.avatarSelected : {}) }}
                aria-label={`アイコン ${a}`}
                aria-pressed={a === avatar}
              >
                {a}
              </button>
            ))}
          </div>

          <input
            style={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="なまえ（なくてもいいよ）"
            maxLength={12}
            aria-label="なまえ"
          />

          <p style={styles.ageLabel}>なんさい？</p>
          <div style={styles.ageGrid}>
            {ages.map(a => (
              <button
                key={a}
                onClick={() => setAge(a)}
                style={{ ...styles.ageButton, ...(a === age ? styles.ageSelected : {}) }}
                aria-pressed={a === age}
              >
                {a}
                <span style={styles.ageUnit}>さい</span>
              </button>
            ))}
          </div>

          <div style={styles.buttons}>
            <button onClick={handleCreate} disabled={age === null} style={styles.primaryButton}>
              これで はじめる！
            </button>
            {(profiles.length > 0 || onCancel) && (
              <button onClick={() => (profiles.length > 0 ? setCreating(false) : onCancel?.())} style={styles.secondaryButton}>
                もどる
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>だれが あそぶ？</h1>
        <div style={styles.profileGrid}>
          {profiles.map(p => (
            <button key={p.id} onClick={() => handleSelect(p)} style={styles.profileButton} aria-label={`${p.name}であそぶ`}>
              <span style={styles.profileAvatar}>{p.avatar}</span>
              <span style={styles.profileName}>{p.name}</span>
              <span style={styles.profileAge}>{p.age} さい</span>
            </button>
          ))}
          <button onClick={() => { setCreating(true); setAge(null); setName(''); }} style={{ ...styles.profileButton, ...styles.addButton }}>
            <span style={styles.profileAvatar}>＋</span>
            <span style={styles.profileName}>あたらしく つくる</span>
          </button>
        </div>
        {onCancel && (
          <button onClick={onCancel} style={{ ...styles.secondaryButton, marginTop: '18px' }}>
            もどる
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(160deg, #ffe8a3 0%, #ffb4a2 50%, #b5e2ff 100%)',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'white',
    borderRadius: '28px',
    padding: '28px 22px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 6px',
    fontSize: '1.8rem',
    color: '#333',
  },
  lead: {
    margin: '0 0 18px',
    color: '#666',
    fontSize: '1.05rem',
  },
  avatarRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '14px',
  },
  avatarButton: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    border: '3px solid transparent',
    backgroundColor: '#f3f3f3',
    fontSize: '1.5rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  avatarSelected: {
    borderColor: '#4a90d9',
    backgroundColor: '#e3f0ff',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '1.1rem',
    borderRadius: '14px',
    border: '2px solid #ddd',
    textAlign: 'center',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  ageLabel: {
    margin: '18px 0 8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#444',
  },
  ageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '8px',
  },
  ageButton: {
    padding: '10px 0',
    fontSize: '1.3rem',
    fontWeight: 'bold',
    borderRadius: '14px',
    border: '3px solid #e5e5e5',
    backgroundColor: '#fafafa',
    color: '#333',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1.1,
    fontFamily: 'inherit',
  },
  ageSelected: {
    borderColor: '#ff9800',
    backgroundColor: '#fff3e0',
    color: '#e65100',
  },
  ageUnit: {
    fontSize: '0.7rem',
    fontWeight: 'normal',
    color: '#888',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '22px',
  },
  primaryButton: {
    padding: '15px 24px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
    fontFamily: 'inherit',
  },
  secondaryButton: {
    padding: '11px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: '#eee',
    color: '#333',
    border: 'none',
    borderRadius: '25px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '12px',
    marginTop: '18px',
  },
  profileButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '18px 10px',
    borderRadius: '20px',
    border: '3px solid #eee',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  addButton: {
    borderStyle: 'dashed',
    backgroundColor: 'white',
  },
  profileAvatar: {
    fontSize: '2.6rem',
    lineHeight: 1,
  },
  profileName: {
    fontSize: '1.05rem',
    fontWeight: 'bold',
    color: '#333',
  },
  profileAge: {
    fontSize: '0.85rem',
    color: '#888',
  },
};
