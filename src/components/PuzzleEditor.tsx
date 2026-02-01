import { useState, useCallback, useRef } from 'react';
import { Target, CONSTANTS } from '../types';

interface Props {
  onBack: () => void;
}

interface EditorTarget extends Target {
  id: string;
}

export function PuzzleEditor({ onBack }: Props) {
  const [puzzleName, setPuzzleName] = useState('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targets, setTargets] = useState<EditorTarget[]>([]);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // ファイル選択
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // 画像クリックで座標追加
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageSrc) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const img = container.querySelector('img');
    if (!img) return;

    // object-fit: contain を考慮した位置計算
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageNaturalSize.width / imageNaturalSize.height || 1;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

    if (containerAspect > imageAspect) {
      displayHeight = rect.height;
      displayWidth = displayHeight * imageAspect;
      offsetX = (rect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = rect.width;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (rect.height - displayHeight) / 2;
    }

    const relX = e.clientX - rect.left - offsetX;
    const relY = e.clientY - rect.top - offsetY;

    if (relX < 0 || relX > displayWidth || relY < 0 || relY > displayHeight) {
      return;
    }

    // 0-1000スケールに変換
    const scaleX = Math.round((relX / displayWidth) * CONSTANTS.SCALE);
    const scaleY = Math.round((relY / displayHeight) * CONSTANTS.SCALE);

    const newTarget: EditorTarget = {
      id: Date.now().toString(),
      title: `アイテム${targets.length + 1}`,
      position: [scaleX, scaleY],
    };

    setTargets(prev => [...prev, newTarget]);
    setEditingTarget(newTarget.id);
  }, [imageSrc, targets.length, imageNaturalSize]);

  // ターゲット名変更
  const handleTargetNameChange = useCallback((id: string, newTitle: string) => {
    setTargets(prev => prev.map(t => (t.id === id ? { ...t, title: newTitle } : t)));
  }, []);

  // ターゲット削除
  const handleTargetDelete = useCallback((id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    if (editingTarget === id) {
      setEditingTarget(null);
    }
  }, [editingTarget]);

  // JSONインポート
  const handleJsonImport = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        throw new Error('配列形式のJSONを入力してください');
      }

      const importedTargets: EditorTarget[] = parsed.map((item, index) => ({
        id: `imported-${Date.now()}-${index}`,
        title: item.title || `アイテム${index + 1}`,
        position: item.position || [500, 500],
      }));

      setTargets(importedTargets);
      setShowJsonImport(false);
      setJsonInput('');
    } catch (err) {
      alert('JSONの解析に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    }
  }, [jsonInput]);

  // JSONエクスポート
  const exportJson = useCallback(() => {
    const exportData = {
      id: puzzleName.toLowerCase().replace(/\s+/g, '-') || 'new-puzzle',
      name: puzzleName || '新しいパズル',
      imageSrc: `puzzles/images/${puzzleName.toLowerCase().replace(/\s+/g, '-') || 'puzzle'}.webp`,
      targets: targets.map(t => ({
        title: t.title,
        position: t.position,
      })),
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [puzzleName, targets]);

  // ターゲットの表示位置を計算
  const getTargetDisplayPosition = useCallback((target: EditorTarget) => {
    const container = imageContainerRef.current;
    if (!container || !imageNaturalSize.width) return null;

    const rect = container.getBoundingClientRect();
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

    if (containerAspect > imageAspect) {
      displayHeight = rect.height;
      displayWidth = displayHeight * imageAspect;
      offsetX = (rect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = rect.width;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (rect.height - displayHeight) / 2;
    }

    const [x, y] = target.position;
    const pixelX = offsetX + (x / CONSTANTS.SCALE) * displayWidth;
    const pixelY = offsetY + (y / CONSTANTS.SCALE) * displayHeight;

    return { x: pixelX, y: pixelY };
  }, [imageNaturalSize]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ← もどる
        </button>
        <h1 style={styles.title}>パズルエディタ</h1>
        <button onClick={exportJson} style={styles.exportButton} disabled={targets.length === 0}>
          📥 JSON出力
        </button>
      </header>

      <div style={styles.main}>
        {/* 左: 設定パネル */}
        <div style={styles.sidebar}>
          <div style={styles.section}>
            <label style={styles.label}>パズル名</label>
            <input
              type="text"
              value={puzzleName}
              onChange={e => setPuzzleName(e.target.value)}
              placeholder="おもちゃの部屋"
              style={styles.input}
            />
          </div>

          <div style={styles.section}>
            <label style={styles.label}>画像</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={styles.uploadButton}
            >
              📁 画像を選択
            </button>
            {imageFile && (
              <p style={styles.fileName}>{imageFile.name}</p>
            )}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <label style={styles.label}>ターゲット ({targets.length})</label>
              <button
                onClick={() => setShowJsonImport(!showJsonImport)}
                style={styles.smallButton}
              >
                📋 JSONインポート
              </button>
            </div>

            {showJsonImport && (
              <div style={styles.jsonImport}>
                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder='[{"title": "リス", "position": [495, 80]}, ...]'
                  style={styles.textarea}
                />
                <button onClick={handleJsonImport} style={styles.importButton}>
                  インポート
                </button>
              </div>
            )}

            <div style={styles.targetList}>
              {targets.map((target, index) => (
                <div key={target.id} style={styles.targetItem}>
                  <span style={styles.targetIndex}>{index + 1}</span>
                  <input
                    type="text"
                    value={target.title}
                    onChange={e => handleTargetNameChange(target.id, e.target.value)}
                    style={styles.targetInput}
                  />
                  <span style={styles.targetCoord}>
                    ({target.position[0]}, {target.position[1]})
                  </span>
                  <button
                    onClick={() => handleTargetDelete(target.id)}
                    style={styles.deleteButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p style={styles.hint}>
            💡 画像をクリックしてターゲットを追加
          </p>
        </div>

        {/* 右: 画像プレビュー */}
        <div style={styles.preview}>
          {imageSrc ? (
            <div
              ref={imageContainerRef}
              style={styles.imageContainer}
              onClick={handleImageClick}
            >
              <img
                src={imageSrc}
                alt="プレビュー"
                style={styles.image}
                onLoad={e => {
                  const img = e.currentTarget;
                  setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                }}
                draggable={false}
              />

              {/* ターゲットマーカー */}
              {targets.map(target => {
                const pos = getTargetDisplayPosition(target);
                if (!pos) return null;
                return (
                  <div
                    key={target.id}
                    style={{
                      ...styles.marker,
                      left: pos.x,
                      top: pos.y,
                      backgroundColor: editingTarget === target.id ? '#ff5722' : '#4caf50',
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      setEditingTarget(target.id);
                    }}
                  >
                    <span style={styles.markerNumber}>
                      {targets.findIndex(t => t.id === target.id) + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.placeholder}>
              <p>画像を選択してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    backgroundColor: '#333',
    color: 'white',
  },
  backButton: {
    padding: '8px 15px',
    fontSize: '1rem',
    backgroundColor: 'transparent',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
  },
  exportButton: {
    padding: '8px 15px',
    fontSize: '1rem',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '320px',
    backgroundColor: 'white',
    padding: '20px',
    overflowY: 'auto',
    borderRight: '1px solid #ddd',
  },
  section: {
    marginBottom: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxSizing: 'border-box',
  },
  uploadButton: {
    width: '100%',
    padding: '12px',
    fontSize: '1rem',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  fileName: {
    fontSize: '0.85rem',
    color: '#666',
    marginTop: '8px',
    wordBreak: 'break-all',
  },
  smallButton: {
    padding: '5px 10px',
    fontSize: '0.8rem',
    backgroundColor: '#e0e0e0',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  jsonImport: {
    marginBottom: '15px',
  },
  textarea: {
    width: '100%',
    height: '100px',
    padding: '10px',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    border: '1px solid #ddd',
    borderRadius: '8px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  importButton: {
    marginTop: '8px',
    padding: '8px 15px',
    fontSize: '0.9rem',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  targetList: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  targetItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#f8f8f8',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  targetIndex: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4caf50',
    color: 'white',
    borderRadius: '50%',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  targetInput: {
    flex: 1,
    padding: '5px 8px',
    fontSize: '0.9rem',
    border: '1px solid #ddd',
    borderRadius: '5px',
    minWidth: 0,
  },
  targetCoord: {
    fontSize: '0.75rem',
    color: '#999',
    flexShrink: 0,
  },
  deleteButton: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5722',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '1rem',
    flexShrink: 0,
  },
  hint: {
    fontSize: '0.9rem',
    color: '#666',
    textAlign: 'center',
    marginTop: '20px',
  },
  preview: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: '#e0e0e0',
  },
  imageContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: '100%',
    cursor: 'crosshair',
  },
  image: {
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 120px)',
    objectFit: 'contain',
    display: 'block',
  },
  marker: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    border: '2px solid white',
  },
  markerNumber: {
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  placeholder: {
    color: '#999',
    fontSize: '1.2rem',
  },
};
