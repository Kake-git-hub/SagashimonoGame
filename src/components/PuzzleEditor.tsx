import { useState, useCallback, useRef, useEffect } from 'react';
import { Target, CONSTANTS, CustomPuzzle } from '../types';
import { saveCustomPuzzle } from '../services/storageService';

interface Props {
  onBack: () => void;
  onPuzzleCreated?: (puzzleId: string) => void;
}

interface EditorTarget extends Target {
  id: string;
}

export function PuzzleEditor({ onBack, onPuzzleCreated }: Props) {
  const [puzzleName, setPuzzleName] = useState('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targets, setTargets] = useState<EditorTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [draggingTarget, setDraggingTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // コンテナサイズの更新
  useEffect(() => {
    const updateRect = () => {
      if (imageContainerRef.current) {
        setContainerRect(imageContainerRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [imageSrc]);

  // 画像表示領域の計算
  const getImageDisplayInfo = useCallback(() => {
    if (!containerRect || !imageNaturalSize.width) return null;

    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = imageNaturalSize.width / imageNaturalSize.height || 1;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

    if (containerAspect > imageAspect) {
      displayHeight = containerRect.height;
      displayWidth = displayHeight * imageAspect;
      offsetX = (containerRect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = containerRect.width;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerRect.height - displayHeight) / 2;
    }

    return { displayWidth, displayHeight, offsetX, offsetY };
  }, [containerRect, imageNaturalSize]);

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

  // クライアント座標からスケール座標に変換
  const clientToScaleCoords = useCallback((clientX: number, clientY: number): [number, number] | null => {
    if (!containerRect) return null;
    const info = getImageDisplayInfo();
    if (!info) return null;

    const { displayWidth, displayHeight, offsetX, offsetY } = info;

    const relX = clientX - containerRect.left - offsetX;
    const relY = clientY - containerRect.top - offsetY;

    if (relX < 0 || relX > displayWidth || relY < 0 || relY > displayHeight) {
      return null;
    }

    const scaleX = Math.round((relX / displayWidth) * CONSTANTS.SCALE);
    const scaleY = Math.round((relY / displayHeight) * CONSTANTS.SCALE);

    return [
      Math.max(0, Math.min(CONSTANTS.SCALE, scaleX)),
      Math.max(0, Math.min(CONSTANTS.SCALE, scaleY))
    ];
  }, [containerRect, getImageDisplayInfo]);

  // 画像クリックで座標追加
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageSrc || draggingTarget) return;

    const coords = clientToScaleCoords(e.clientX, e.clientY);
    if (!coords) return;

    const newTarget: EditorTarget = {
      id: Date.now().toString(),
      title: `アイテム${targets.length + 1}`,
      position: coords,
    };

    setTargets(prev => [...prev, newTarget]);
    setSelectedTarget(newTarget.id);
  }, [imageSrc, targets.length, clientToScaleCoords, draggingTarget]);

  // ターゲットのドラッグ開始
  const handleMarkerMouseDown = useCallback((e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingTarget(targetId);
    setSelectedTarget(targetId);
  }, []);

  // ドラッグ中の移動
  useEffect(() => {
    if (!draggingTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      const coords = clientToScaleCoords(e.clientX, e.clientY);
      if (!coords) return;

      setTargets(prev => prev.map(t => 
        t.id === draggingTarget ? { ...t, position: coords } : t
      ));
    };

    const handleMouseUp = () => {
      setDraggingTarget(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTarget, clientToScaleCoords]);

  // タッチ対応
  const handleMarkerTouchStart = useCallback((e: React.TouchEvent, targetId: string) => {
    e.stopPropagation();
    setDraggingTarget(targetId);
    setSelectedTarget(targetId);
  }, []);

  useEffect(() => {
    if (!draggingTarget) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const coords = clientToScaleCoords(touch.clientX, touch.clientY);
      if (!coords) return;

      setTargets(prev => prev.map(t => 
        t.id === draggingTarget ? { ...t, position: coords } : t
      ));
    };

    const handleTouchEnd = () => {
      setDraggingTarget(null);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggingTarget, clientToScaleCoords]);

  // ターゲット名変更
  const handleTargetNameChange = useCallback((id: string, newTitle: string) => {
    setTargets(prev => prev.map(t => (t.id === id ? { ...t, title: newTitle } : t)));
  }, []);

  // ターゲット削除
  const handleTargetDelete = useCallback((id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    if (selectedTarget === id) {
      setSelectedTarget(null);
    }
  }, [selectedTarget]);

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

  // パズル完成（保存）
  const handleComplete = useCallback(async () => {
    if (!imageSrc || targets.length === 0) {
      alert('画像とターゲットを追加してください');
      return;
    }

    if (!puzzleName.trim()) {
      alert('パズル名を入力してください');
      return;
    }

    setSaving(true);
    try {
      const puzzleId = `custom-${Date.now()}`;
      const customPuzzle: CustomPuzzle = {
        id: puzzleId,
        name: puzzleName.trim(),
        imageSrc: puzzleId, // カスタムパズルはIDで識別
        imageData: imageSrc,
        targets: targets.map(t => ({
          title: t.title,
          position: t.position,
        })),
        createdAt: Date.now(),
      };

      saveCustomPuzzle(customPuzzle);
      alert('パズルを保存しました！');
      
      if (onPuzzleCreated) {
        onPuzzleCreated(puzzleId);
      } else {
        onBack();
      }
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    } finally {
      setSaving(false);
    }
  }, [imageSrc, targets, puzzleName, onBack, onPuzzleCreated]);

  // ターゲットの表示位置を計算
  const getTargetDisplayPosition = useCallback((target: EditorTarget) => {
    const info = getImageDisplayInfo();
    if (!info) return null;

    const { displayWidth, displayHeight, offsetX, offsetY } = info;
    const [x, y] = target.position;
    const pixelX = offsetX + (x / CONSTANTS.SCALE) * displayWidth;
    const pixelY = offsetY + (y / CONSTANTS.SCALE) * displayHeight;

    return { x: pixelX, y: pixelY };
  }, [getImageDisplayInfo]);

  const canComplete = imageSrc && targets.length > 0 && puzzleName.trim();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ← もどる
        </button>
        <h1 style={styles.title}>パズルエディタ</h1>
        <div style={styles.headerButtons}>
          <button onClick={exportJson} style={styles.exportButton} disabled={targets.length === 0}>
            📥 JSON
          </button>
          <button 
            onClick={handleComplete} 
            style={{
              ...styles.completeButton,
              opacity: canComplete ? 1 : 0.5,
            }}
            disabled={!canComplete || saving}
          >
            {saving ? '保存中...' : '✅ 完成'}
          </button>
        </div>
      </header>

      <div style={styles.main}>
        {/* 左: 設定パネル */}
        <div style={styles.sidebar}>
          <div style={styles.section}>
            <label style={styles.label}>パズル名 *</label>
            <input
              type="text"
              value={puzzleName}
              onChange={e => setPuzzleName(e.target.value)}
              placeholder="おもちゃの部屋"
              style={styles.input}
            />
          </div>

          <div style={styles.section}>
            <label style={styles.label}>画像 *</label>
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
                <div 
                  key={target.id} 
                  style={{
                    ...styles.targetItem,
                    backgroundColor: selectedTarget === target.id ? '#fff3e0' : '#f8f8f8',
                    borderColor: selectedTarget === target.id ? '#ff9800' : 'transparent',
                  }}
                  onClick={() => setSelectedTarget(target.id)}
                >
                  <span style={styles.targetIndex}>{index + 1}</span>
                  <input
                    type="text"
                    value={target.title}
                    onChange={e => handleTargetNameChange(target.id, e.target.value)}
                    style={styles.targetInput}
                    onClick={e => e.stopPropagation()}
                  />
                  <span style={styles.targetCoord}>
                    ({target.position[0]}, {target.position[1]})
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTargetDelete(target.id);
                    }}
                    style={styles.deleteButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.hintBox}>
            <p style={styles.hint}>💡 画像をクリック → ターゲット追加</p>
            <p style={styles.hint}>🖐️ マーカーをドラッグ → 位置調整</p>
          </div>
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
                  // 遅延してrectを更新
                  setTimeout(() => {
                    if (imageContainerRef.current) {
                      setContainerRect(imageContainerRef.current.getBoundingClientRect());
                    }
                  }, 100);
                }}
                draggable={false}
              />

              {/* ターゲットマーカー */}
              {targets.map(target => {
                const pos = getTargetDisplayPosition(target);
                if (!pos) return null;
                const isSelected = selectedTarget === target.id;
                const isDragging = draggingTarget === target.id;
                return (
                  <div
                    key={target.id}
                    style={{
                      ...styles.marker,
                      left: pos.x,
                      top: pos.y,
                      backgroundColor: isDragging ? '#ff5722' : isSelected ? '#ff9800' : '#4caf50',
                      transform: `translate(-50%, -50%) scale(${isDragging ? 1.2 : 1})`,
                      cursor: 'grab',
                      zIndex: isDragging ? 100 : isSelected ? 50 : 10,
                    }}
                    onMouseDown={e => handleMarkerMouseDown(e, target.id)}
                    onTouchStart={e => handleMarkerTouchStart(e, target.id)}
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
              <p>📷 画像を選択してください</p>
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
    gap: '10px',
  },
  backButton: {
    padding: '8px 15px',
    fontSize: '1rem',
    backgroundColor: 'transparent',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '20px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.3rem',
    flex: 1,
    textAlign: 'center',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  exportButton: {
    padding: '8px 12px',
    fontSize: '0.9rem',
    backgroundColor: '#607d8b',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  completeButton: {
    padding: '8px 15px',
    fontSize: '1rem',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
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
    display: 'flex',
    flexDirection: 'column',
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
    maxHeight: '250px',
    overflowY: 'auto',
  },
  targetItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '8px',
    marginBottom: '8px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
    fontFamily: 'monospace',
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
  hintBox: {
    marginTop: 'auto',
    padding: '15px',
    backgroundColor: '#e3f2fd',
    borderRadius: '10px',
  },
  hint: {
    fontSize: '0.85rem',
    color: '#1565c0',
    margin: '5px 0',
  },
  preview: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'crosshair',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    display: 'block',
    userSelect: 'none',
  },
  marker: {
    position: 'absolute',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    border: '2px solid white',
    transition: 'transform 0.1s, background-color 0.2s',
    touchAction: 'none',
  },
  markerNumber: {
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    pointerEvents: 'none',
  },
  placeholder: {
    color: '#999',
    fontSize: '1.2rem',
    textAlign: 'center',
  },
};
