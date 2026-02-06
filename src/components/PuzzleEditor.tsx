import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Target, CONSTANTS, CustomPuzzle, MarkerSize, Position, getMarkerPixelSize, isLegacyPosition, isPolygonPosition, CirclePosition, PolygonPosition } from '../types';
import { saveCustomPuzzle } from '../services/storageService';
import { compressImage, formatSize, estimateBase64Size } from '../services/imageService';
import { uploadPuzzleToServer, validateGitHubToken } from '../services/githubService';

interface Props {
  onBack: () => void;
  onPuzzleCreated?: (puzzleId: string) => void;
  editPuzzle?: CustomPuzzle | null; // 編集モード用
  isServerPuzzle?: boolean; // サーバーパズル編集かどうか
}

// 円形の座標
interface CircleEditorPosition {
  type: 'circle';
  x: number;
  y: number;
  size: MarkerSize;
}

// ポリゴンの座標
interface PolygonEditorPosition {
  type: 'polygon';
  points: { x: number; y: number }[];
}

type EditorPosition = CircleEditorPosition | PolygonEditorPosition;

// 描画モード
type DrawMode = 'circle' | 'polygon';

interface EditorTarget {
  id: string;
  title: string;
  positions: EditorPosition[];
}

interface MarkerInfo {
  targetId: string;
  positionIndex: number;
  pointIndex?: number; // ポリゴンの頂点インデックス
}

export function PuzzleEditor({ onBack, onPuzzleCreated, editPuzzle, isServerPuzzle = false }: Props) {
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [puzzleName, setPuzzleName] = useState('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targets, setTargets] = useState<EditorTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [draggingMarker, setDraggingMarker] = useState<MarkerInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageSize, setImageSize] = useState<string>('');
  const [defaultMarkerSize, setDefaultMarkerSize] = useState<MarkerSize>('medium'); // 新規追加時のデフォルトサイズ
  
  // ポリゴン描画用の状態
  const [drawMode, setDrawMode] = useState<DrawMode>('circle');
  const [drawingPolygon, setDrawingPolygon] = useState<{ x: number; y: number }[]>([]); // 描画中のポリゴン頂点

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // 編集モードの初期化
  useEffect(() => {
    if (editPuzzle) {
      setPuzzleId(editPuzzle.id);
      setPuzzleName(editPuzzle.name);
      setImageSrc(editPuzzle.imageData);
      setImageSize(formatSize(estimateBase64Size(editPuzzle.imageData)));
      setTargets(editPuzzle.targets.map((t, i) => ({
        id: `edit-${i}-${Date.now()}`,
        title: t.title,
        positions: t.positions.map(p => {
          // 旧形式（配列）と新形式（オブジェクト）両方に対応
          if (isLegacyPosition(p as Position | [number, number])) {
            const [x, y] = p as unknown as [number, number];
            return { type: 'circle', x, y, size: 'medium' as MarkerSize } as CircleEditorPosition;
          }
          const pos = p as unknown as Position;
          // ポリゴンの場合
          if (isPolygonPosition(pos)) {
            return { type: 'polygon', points: pos.points } as PolygonEditorPosition;
          }
          const circlePos = pos as CirclePosition;
          return { type: 'circle', x: circlePos.x, y: circlePos.y, size: circlePos.size } as CircleEditorPosition;
        }),
      })));
    }
  }, [editPuzzle]);

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

  // ファイル選択（圧縮付き）
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    setImageFile(file);
    
    // まずファイルを読み込み
    const reader = new FileReader();
    reader.onload = async () => {
      const originalDataUrl = reader.result as string;
      
      try {
        // 圧縮
        const compressedDataUrl = await compressImage(originalDataUrl);
        const size = estimateBase64Size(compressedDataUrl);
        setImageSrc(compressedDataUrl);
        setImageSize(formatSize(size));
      } catch (err) {
        console.error('Image compression failed:', err);
        // 圧縮失敗時はそのまま使用
        setImageSrc(originalDataUrl);
        setImageSize(formatSize(estimateBase64Size(originalDataUrl)));
      }
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

  // 新しいターゲットを追加（ボタンから）
  const handleAddTarget = useCallback(() => {
    const newTarget: EditorTarget = {
      id: Date.now().toString(),
      title: `アイテム${targets.length + 1}`,
      positions: [{ type: 'circle', x: 500, y: 500, size: defaultMarkerSize }], // 中央に配置
    };
    setTargets(prev => [...prev, newTarget]);
    setSelectedTarget(newTarget.id);
  }, [targets.length, defaultMarkerSize]);

  // ターゲットに円形座標を追加
  const handleAddPosition = useCallback((targetId: string) => {
    setTargets(prev => prev.map(t => {
      if (t.id !== targetId) return t;
      // 最後の座標から少しずらした位置に追加
      const lastPos = t.positions[t.positions.length - 1];
      let baseX = 500, baseY = 500;
      if (lastPos.type === 'circle') {
        baseX = lastPos.x;
        baseY = lastPos.y;
      } else if (lastPos.type === 'polygon' && lastPos.points.length > 0) {
        // ポリゴンの最後の点を基準
        baseX = lastPos.points[0].x;
        baseY = lastPos.points[0].y;
      }
      const newPos: CircleEditorPosition = {
        type: 'circle',
        x: Math.min(CONSTANTS.SCALE, baseX + 50),
        y: Math.min(CONSTANTS.SCALE, baseY + 50),
        size: defaultMarkerSize,
      };
      return { ...t, positions: [...t.positions, newPos] };
    }));
  }, [defaultMarkerSize]);

  // 座標のサイズを変更（円形のみ）
  const handleChangePositionSize = useCallback((targetId: string, posIndex: number, size: MarkerSize) => {
    setTargets(prev => prev.map(t => {
      if (t.id !== targetId) return t;
      const newPositions = [...t.positions];
      const pos = newPositions[posIndex];
      if (pos.type === 'circle') {
        newPositions[posIndex] = { ...pos, size };
      }
      return { ...t, positions: newPositions };
    }));
  }, []);

  // 座標を削除
  const handleDeletePosition = useCallback((targetId: string, posIndex: number) => {
    setTargets(prev => prev.map(t => {
      if (t.id !== targetId) return t;
      if (t.positions.length <= 1) return t; // 最低1つは残す
      const newPositions = t.positions.filter((_, i) => i !== posIndex);
      return { ...t, positions: newPositions };
    }));
  }, []);

  // マーカーのドラッグ開始
  const handleMarkerMouseDown = useCallback((e: React.MouseEvent, marker: MarkerInfo) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingMarker(marker);
    setSelectedTarget(marker.targetId);
  }, []);

  // ドラッグ中の移動
  useEffect(() => {
    if (!draggingMarker) return;

    const handleMouseMove = (e: MouseEvent) => {
      const coords = clientToScaleCoords(e.clientX, e.clientY);
      if (!coords) return;

      setTargets(prev => prev.map(t => {
        if (t.id !== draggingMarker.targetId) return t;
        const newPositions = [...t.positions];
        const currentPos = newPositions[draggingMarker.positionIndex];
        
        if (currentPos.type === 'circle') {
          newPositions[draggingMarker.positionIndex] = { ...currentPos, x: coords[0], y: coords[1] };
        } else if (currentPos.type === 'polygon' && draggingMarker.pointIndex !== undefined) {
          // ポリゴンの頂点をドラッグ
          const newPoints = [...currentPos.points];
          newPoints[draggingMarker.pointIndex] = { x: coords[0], y: coords[1] };
          newPositions[draggingMarker.positionIndex] = { ...currentPos, points: newPoints };
        }
        
        return { ...t, positions: newPositions };
      }));
    };

    const handleMouseUp = () => {
      setDraggingMarker(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingMarker, clientToScaleCoords]);

  // タッチ対応
  const handleMarkerTouchStart = useCallback((e: React.TouchEvent, marker: MarkerInfo) => {
    e.stopPropagation();
    setDraggingMarker(marker);
    setSelectedTarget(marker.targetId);
  }, []);

  useEffect(() => {
    if (!draggingMarker) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const coords = clientToScaleCoords(touch.clientX, touch.clientY);
      if (!coords) return;

      setTargets(prev => prev.map(t => {
        if (t.id !== draggingMarker.targetId) return t;
        const newPositions = [...t.positions];
        const currentPos = newPositions[draggingMarker.positionIndex];
        
        if (currentPos.type === 'circle') {
          newPositions[draggingMarker.positionIndex] = { ...currentPos, x: coords[0], y: coords[1] };
        } else if (currentPos.type === 'polygon' && draggingMarker.pointIndex !== undefined) {
          const newPoints = [...currentPos.points];
          newPoints[draggingMarker.pointIndex] = { x: coords[0], y: coords[1] };
          newPositions[draggingMarker.positionIndex] = { ...currentPos, points: newPoints };
        }
        
        return { ...t, positions: newPositions };
      }));
    };

    const handleTouchEnd = () => {
      setDraggingMarker(null);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggingMarker, clientToScaleCoords]);

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

  // JSONインポート（複数座標形式対応）
  const handleJsonImport = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        throw new Error('配列形式のJSONを入力してください');
      }

      const importedTargets: EditorTarget[] = parsed.map((item, index) => {
        // positions配列またはposition単体を処理
        let positions: EditorPosition[];
        if (Array.isArray(item.positions)) {
          positions = item.positions.map((p: unknown) => {
            // 配列形式 [x, y] の場合
            if (Array.isArray(p)) {
              return { type: 'circle', x: p[0], y: p[1], size: defaultMarkerSize } as CircleEditorPosition;
            }
            // ポリゴン形式 { type: 'polygon', points: [...] } の場合
            const pos = p as { type?: string; x?: number; y?: number; size?: MarkerSize; points?: { x: number; y: number }[] };
            if (pos.type === 'polygon' && Array.isArray(pos.points)) {
              return { type: 'polygon', points: pos.points } as PolygonEditorPosition;
            }
            // 円形形式 { x, y, size } の場合
            return {
              type: 'circle',
              x: pos.x ?? 500,
              y: pos.y ?? 500,
              size: pos.size ?? defaultMarkerSize,
            } as CircleEditorPosition;
          });
        } else if (Array.isArray(item.position)) {
          positions = [{ type: 'circle', x: item.position[0], y: item.position[1], size: defaultMarkerSize }];
        } else {
          positions = [{ type: 'circle', x: 500, y: 500, size: defaultMarkerSize }];
        }

        return {
          id: `imported-${Date.now()}-${index}`,
          title: item.title || `アイテム${index + 1}`,
          positions,
        };
      });

      setTargets(importedTargets);
      setShowJsonImport(false);
      setJsonInput('');
    } catch (err) {
      alert('JSONの解析に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'));
    }
  }, [jsonInput, defaultMarkerSize]);

  // JSONエクスポート
  const exportJson = useCallback(() => {
    const exportData = {
      id: puzzleName.toLowerCase().replace(/\s+/g, '-') || 'new-puzzle',
      name: puzzleName || '新しいパズル',
      imageSrc: `puzzles/images/${puzzleName.toLowerCase().replace(/\s+/g, '-') || 'puzzle'}.webp`,
      targets: targets.map(t => ({
        title: t.title,
        positions: t.positions,
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
      const exportTargets: Target[] = targets.map(t => ({
        title: t.title,
        positions: t.positions.map(p => {
          if (p.type === 'polygon') {
            return { type: 'polygon', points: p.points } as PolygonPosition;
          }
          return { x: p.x, y: p.y, size: p.size } as CirclePosition;
        }),
      }));

      // サーバーパズル編集の場合はサーバーにアップロード
      if (isServerPuzzle && editPuzzle) {
        // トークン取得
        let token = localStorage.getItem('github_pat');
        if (!token) {
          token = prompt(
            '🔐 サーバーパズルの更新\n\n' +
            'GitHubのPersonal Access Token (PAT) を入力してください。\n' +
            '必要な権限: repo (Contents: Read and write)'
          );
          
          if (!token) {
            setSaving(false);
            return;
          }
          
          const isValid = await validateGitHubToken(token);
          if (!isValid) {
            alert('トークンが無効です。');
            setSaving(false);
            return;
          }
          
          localStorage.setItem('github_pat', token);
        }

        const result = await uploadPuzzleToServer(token, {
          id: editPuzzle.name, // サーバーパズルはnameをIDとして使用
          name: puzzleName.trim(),
          targets: exportTargets,
          imageData: imageSrc,
        });

        if (result.success) {
          alert(result.message);
          if (onPuzzleCreated) {
            onPuzzleCreated(editPuzzle.name);
          } else {
            onBack();
          }
        } else {
          if (result.message.includes('Bad credentials') || result.message.includes('401')) {
            localStorage.removeItem('github_pat');
            alert('トークンが無効です。再度入力してください。\n\n' + result.message);
          } else {
            alert('サーバーへのアップロードに失敗しました:\n' + result.message);
          }
        }
      } else {
        // ローカル保存（カスタムパズル）
        const saveId = puzzleId || `custom-${Date.now()}`;

        const customPuzzle: CustomPuzzle = {
          id: saveId,
          name: puzzleName.trim(),
          imageSrc: saveId,
          imageData: imageSrc,
          targets: exportTargets,
          createdAt: editPuzzle?.createdAt || Date.now(),
        };

        saveCustomPuzzle(customPuzzle);
        alert(editPuzzle ? 'パズルを更新しました！' : 'パズルを保存しました！');
        
        if (onPuzzleCreated) {
          onPuzzleCreated(saveId);
        } else {
          onBack();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラー';
      if (message.includes('quota')) {
        alert('保存に失敗しました: ストレージ容量が不足しています。\n古いパズルを削除するか、より小さい画像を使用してください。');
      } else {
        alert('保存に失敗しました: ' + message);
      }
    } finally {
      setSaving(false);
    }
  }, [imageSrc, targets, puzzleName, puzzleId, editPuzzle, isServerPuzzle, onBack, onPuzzleCreated]);

  // 座標の表示位置を計算（円形用）
  const getPositionDisplayCoords = useCallback((pos: CircleEditorPosition) => {
    const info = getImageDisplayInfo();
    if (!info) return null;

    const { displayWidth, displayHeight, offsetX, offsetY } = info;
    const pixelX = offsetX + (pos.x / CONSTANTS.SCALE) * displayWidth;
    const pixelY = offsetY + (pos.y / CONSTANTS.SCALE) * displayHeight;

    return { x: pixelX, y: pixelY };
  }, [getImageDisplayInfo]);

  // 任意の点の表示位置を計算
  const getPointDisplayCoords = useCallback((x: number, y: number) => {
    const info = getImageDisplayInfo();
    if (!info) return null;

    const { displayWidth, displayHeight, offsetX, offsetY } = info;
    const pixelX = offsetX + (x / CONSTANTS.SCALE) * displayWidth;
    const pixelY = offsetY + (y / CONSTANTS.SCALE) * displayHeight;

    return { x: pixelX, y: pixelY };
  }, [getImageDisplayInfo]);

  // 画像クリック時の処理（ポリゴン描画用）
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    // ドラッグ中やターゲット未選択時は何もしない
    if (draggingMarker || !selectedTarget) return;
    
    // ポリゴンモードの場合
    if (drawMode === 'polygon') {
      const coords = clientToScaleCoords(e.clientX, e.clientY);
      if (!coords) return;
      
      const newPoint = { x: coords[0], y: coords[1] };
      setDrawingPolygon(prev => [...prev, newPoint]);
    }
  }, [draggingMarker, selectedTarget, drawMode, clientToScaleCoords]);

  // ポリゴンを確定（閉じる）
  const handleFinishPolygon = useCallback(() => {
    if (drawingPolygon.length < 3) {
      alert('ポリゴンには少なくとも3点必要です');
      return;
    }
    
    if (!selectedTarget) return;
    
    const newPolygon: PolygonEditorPosition = {
      type: 'polygon',
      points: [...drawingPolygon],
    };
    
    setTargets(prev => prev.map(t => {
      if (t.id !== selectedTarget) return t;
      return { ...t, positions: [...t.positions, newPolygon] };
    }));
    
    setDrawingPolygon([]);
  }, [drawingPolygon, selectedTarget]);

  // ポリゴン描画をキャンセル
  const handleCancelPolygon = useCallback(() => {
    setDrawingPolygon([]);
  }, []);

  // 描画中のポリゴンから1点戻す
  const handleUndoPolygonPoint = useCallback(() => {
    setDrawingPolygon(prev => prev.slice(0, -1));
  }, []);

  const canComplete = imageSrc && targets.length > 0 && puzzleName.trim();

  // ターゲットの色を取得
  const getTargetColor = (targetId: string) => {
    const colors = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ff5722', '#795548'];
    const index = targets.findIndex(t => t.id === targetId);
    return colors[index % colors.length];
  };

  const isEditMode = !!editPuzzle;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ← もどる
        </button>
        <h1 style={styles.title}>
          {isServerPuzzle ? '🌐 サーバーパズル編集' : isEditMode ? '📝 パズル編集' : '✏️ パズル作成'}
        </h1>
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
            {saving ? '保存中...' : isServerPuzzle ? '🚀 サーバーに保存' : isEditMode ? '💾 更新' : '✅ 完成'}
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
            <label style={styles.label}>画像 * {imageSize && `(${imageSize})`}</label>
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
              📁 {imageSrc ? '画像を変更' : '画像を選択'}
            </button>
            {imageFile && (
              <p style={styles.fileName}>{imageFile.name}</p>
            )}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <label style={styles.label}>ターゲット ({targets.length})</label>
              <div style={styles.buttonGroup}>
                <button onClick={handleAddTarget} style={styles.addButton}>
                  ➕ 追加
                </button>
                <button
                  onClick={() => setShowJsonImport(!showJsonImport)}
                  style={styles.smallButton}
                >
                  📋 JSON
                </button>
              </div>
            </div>

            {showJsonImport && (
              <div style={styles.jsonImport}>
                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder='[{"title": "シマウマ", "positions": [[350, 450], [830, 190]]}, ...]'
                  style={styles.textarea}
                />
                <button onClick={handleJsonImport} style={styles.importButton}>
                  インポート
                </button>
              </div>
            )}

            <div style={styles.targetList}>
              {targets.map((target, index) => {
                const isSelected = selectedTarget === target.id;
                const color = getTargetColor(target.id);
                return (
                  <div 
                    key={target.id} 
                    style={{
                      ...styles.targetItem,
                      backgroundColor: isSelected ? '#fff3e0' : '#f8f8f8',
                      borderColor: isSelected ? color : 'transparent',
                    }}
                    onClick={() => setSelectedTarget(target.id)}
                  >
                    <div style={styles.targetHeader}>
                      <span style={{ ...styles.targetIndex, backgroundColor: color }}>
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={target.title}
                        onChange={e => handleTargetNameChange(target.id, e.target.value)}
                        style={styles.targetInput}
                        onClick={e => e.stopPropagation()}
                      />
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
                    {isSelected && (
                      <div style={styles.positionList}>
                        {target.positions.map((pos, posIndex) => (
                          <div key={posIndex} style={styles.positionItem}>
                            {pos.type === 'polygon' ? (
                              <>
                                <span style={styles.positionLabel}>
                                  📐 ポリゴン ({pos.points.length}頂点)
                                </span>
                                {target.positions.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePosition(target.id, posIndex);
                                    }}
                                    style={styles.smallDeleteButton}
                                  >
                                    ×
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <span style={styles.positionLabel}>
                                  座標{posIndex + 1}: ({pos.x}, {pos.y})
                                </span>
                                <div style={styles.sizeButtons}>
                                  {(['small', 'medium', 'large'] as MarkerSize[]).map(size => (
                                    <button
                                      key={size}
                                      style={{
                                        ...styles.sizeButton,
                                        backgroundColor: pos.size === size ? '#4a90d9' : '#ddd',
                                        color: pos.size === size ? 'white' : '#333',
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleChangePositionSize(target.id, posIndex, size);
                                      }}
                                    >
                                      {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                                    </button>
                                  ))}
                                </div>
                                {target.positions.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePosition(target.id, posIndex);
                                    }}
                                    style={styles.smallDeleteButton}
                                  >
                                    ×
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (drawMode === 'polygon') {
                              // ポリゴンモードの場合は描画開始を促す
                              setSelectedTarget(target.id);
                              setDrawingPolygon([]);
                              alert('画像上をクリックしてポリゴンの頂点を追加してください');
                            } else {
                              handleAddPosition(target.id);
                            }
                          }}
                          style={styles.addPositionButton}
                        >
                          {drawMode === 'polygon' ? '+ ポリゴン追加' : '+ 座標追加'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* デフォルトマーカーサイズ選択 */}
          <div style={styles.markerSizeSelector}>
            <span style={styles.markerSizeLabel}>新規追加時のサイズ:</span>
            {(['small', 'medium', 'large'] as MarkerSize[]).map(size => (
              <button
                key={size}
                style={{
                  ...styles.markerSizeButton,
                  backgroundColor: defaultMarkerSize === size ? '#4a90d9' : '#ddd',
                  color: defaultMarkerSize === size ? 'white' : '#333',
                }}
                onClick={() => setDefaultMarkerSize(size)}
              >
                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
              </button>
            ))}
          </div>

          {/* 描画モード選択 */}
          <div style={styles.drawModeSelector}>
            <span style={styles.drawModeLabel}>描画モード:</span>
            <div style={styles.drawModeButtons}>
              <button
                style={{
                  ...styles.drawModeButton,
                  backgroundColor: drawMode === 'circle' ? '#4a90d9' : '#ddd',
                  color: drawMode === 'circle' ? 'white' : '#333',
                }}
                onClick={() => { setDrawMode('circle'); setDrawingPolygon([]); }}
              >
                ⭕ 円形
              </button>
              <button
                style={{
                  ...styles.drawModeButton,
                  backgroundColor: drawMode === 'polygon' ? '#4a90d9' : '#ddd',
                  color: drawMode === 'polygon' ? 'white' : '#333',
                }}
                onClick={() => setDrawMode('polygon')}
              >
                📐 ポリゴン
              </button>
            </div>
          </div>

          {/* ポリゴン描画中のコントロール */}
          {drawMode === 'polygon' && (
            <div style={styles.polygonControls}>
              <p style={styles.polygonInfo}>
                📍 画像をクリックして頂点を追加 ({drawingPolygon.length}点)
              </p>
              <div style={styles.polygonButtons}>
                <button 
                  onClick={handleUndoPolygonPoint}
                  disabled={drawingPolygon.length === 0}
                  style={{
                    ...styles.polygonControlButton,
                    opacity: drawingPolygon.length === 0 ? 0.5 : 1,
                  }}
                >
                  ↩️ 戻す
                </button>
                <button 
                  onClick={handleCancelPolygon}
                  disabled={drawingPolygon.length === 0}
                  style={{
                    ...styles.polygonControlButton,
                    opacity: drawingPolygon.length === 0 ? 0.5 : 1,
                  }}
                >
                  ❌ キャンセル
                </button>
                <button 
                  onClick={handleFinishPolygon}
                  disabled={drawingPolygon.length < 3}
                  style={{
                    ...styles.polygonFinishButton,
                    opacity: drawingPolygon.length < 3 ? 0.5 : 1,
                  }}
                >
                  ✅ 確定
                </button>
              </div>
            </div>
          )}

          <div style={styles.hintBox}>
            <p style={styles.hint}>💡 「追加」ボタン → ターゲット追加</p>
            <p style={styles.hint}>🖐️ マーカーをドラッグ → 位置調整</p>
            <p style={styles.hint}>📍 複数座標 → 「座標追加」ボタン</p>
            <p style={styles.hint}>📐 サイズ: 小(16px) 中(32px) 大(64px)</p>
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
                  setTimeout(() => {
                    if (imageContainerRef.current) {
                      setContainerRect(imageContainerRef.current.getBoundingClientRect());
                    }
                  }, 100);
                }}
                draggable={false}
              />

              {/* ターゲットマーカー */}
              {targets.map((target, targetIndex) => {
                const isSelected = selectedTarget === target.id;
                const color = getTargetColor(target.id);

                return target.positions.map((pos, posIndex) => {
                  // ポリゴンの場合
                  if (pos.type === 'polygon') {
                    const points = pos.points.map(p => getPointDisplayCoords(p.x, p.y));
                    if (points.some(p => !p)) return null;
                    
                    const validPoints = points.filter((p): p is { x: number; y: number } => p !== null);
                    const pathData = validPoints.map((p, i) => 
                      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                    ).join(' ') + ' Z';
                    
                    return (
                      <React.Fragment key={`${target.id}-${posIndex}`}>
                        {/* ポリゴンの塗りつぶし */}
                        <svg style={styles.polygonSvg}>
                          <path
                            d={pathData}
                            fill={color}
                            fillOpacity={isSelected ? 0.4 : 0.2}
                            stroke={color}
                            strokeWidth={isSelected ? 3 : 2}
                          />
                        </svg>
                        {/* 頂点のドラッグハンドル */}
                        {isSelected && validPoints.map((p, pointIndex) => (
                          <div
                            key={`point-${pointIndex}`}
                            style={{
                              ...styles.polygonPoint,
                              left: p.x,
                              top: p.y,
                              backgroundColor: color,
                            }}
                            onMouseDown={e => handleMarkerMouseDown(e, { 
                              targetId: target.id, 
                              positionIndex: posIndex,
                              pointIndex 
                            })}
                            onTouchStart={e => handleMarkerTouchStart(e, {
                              targetId: target.id,
                              positionIndex: posIndex,
                              pointIndex
                            })}
                          >
                            {pointIndex + 1}
                          </div>
                        ))}
                      </React.Fragment>
                    );
                  }

                  // 円形の場合
                  const displayPos = getPositionDisplayCoords(pos);
                  if (!displayPos) return null;

                  const marker: MarkerInfo = { targetId: target.id, positionIndex: posIndex };
                  const isDragging = draggingMarker?.targetId === target.id && 
                                     draggingMarker?.positionIndex === posIndex;
                  const markerPixelSize = getMarkerPixelSize(pos.size);

                  return (
                    <div
                      key={`${target.id}-${posIndex}`}
                      style={{
                        ...styles.marker,
                        width: `${markerPixelSize}px`,
                        height: `${markerPixelSize}px`,
                        left: displayPos.x,
                        top: displayPos.y,
                        backgroundColor: isDragging ? '#ff5722' : color,
                        opacity: isSelected ? 1 : 0.7,
                        transform: `translate(-50%, -50%) scale(${isDragging ? 1.2 : 1})`,
                        cursor: 'grab',
                        zIndex: isDragging ? 100 : isSelected ? 50 : 10,
                      }}
                      onMouseDown={e => handleMarkerMouseDown(e, marker)}
                      onTouchStart={e => handleMarkerTouchStart(e, marker)}
                    >
                      <span style={{
                        ...styles.markerNumber,
                        fontSize: markerPixelSize >= 32 ? '0.75rem' : '0.6rem',
                      }}>
                        {target.positions.length > 1 
                          ? `${targetIndex + 1}-${posIndex + 1}` 
                          : `${targetIndex + 1}`}
                      </span>
                    </div>
                  );
                });
              })}

              {/* 描画中のポリゴン */}
              {drawingPolygon.length > 0 && (
                <>
                  <svg style={styles.polygonSvg}>
                    <path
                      d={drawingPolygon.map((p, i) => {
                        const displayP = getPointDisplayCoords(p.x, p.y);
                        if (!displayP) return '';
                        return `${i === 0 ? 'M' : 'L'} ${displayP.x} ${displayP.y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#ff5722"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                    />
                  </svg>
                  {drawingPolygon.map((p, i) => {
                    const displayP = getPointDisplayCoords(p.x, p.y);
                    if (!displayP) return null;
                    return (
                      <div
                        key={`drawing-${i}`}
                        style={{
                          ...styles.polygonPoint,
                          left: displayP.x,
                          top: displayP.y,
                          backgroundColor: '#ff5722',
                        }}
                      >
                        {i + 1}
                      </div>
                    );
                  })}
                </>
              )}
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
  buttonGroup: {
    display: 'flex',
    gap: '5px',
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
  addButton: {
    padding: '5px 12px',
    fontSize: '0.85rem',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
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
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '8px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  targetHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  targetIndex: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  positionList: {
    marginTop: '10px',
    paddingLeft: '32px',
  },
  positionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    fontSize: '0.8rem',
    flexWrap: 'wrap',
  },
  positionLabel: {
    color: '#666',
    fontFamily: 'monospace',
    minWidth: '100px',
  },
  sizeButtons: {
    display: 'flex',
    gap: '4px',
  },
  sizeButton: {
    padding: '2px 6px',
    fontSize: '0.7rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  smallDeleteButton: {
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5722',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  addPositionButton: {
    marginTop: '5px',
    padding: '4px 10px',
    fontSize: '0.75rem',
    backgroundColor: '#e0e0e0',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  hintBox: {
    padding: '15px',
    backgroundColor: '#e3f2fd',
    borderRadius: '10px',
  },
  hint: {
    fontSize: '0.85rem',
    color: '#1565c0',
    margin: '5px 0',
  },
  markerSizeSelector: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#fff3e0',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  markerSizeLabel: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#333',
  },
  markerSizeButton: {
    padding: '8px 16px',
    fontSize: '0.9rem',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
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
    fontSize: '0.75rem',
    fontWeight: 'bold',
    pointerEvents: 'none',
  },
  placeholder: {
    color: '#999',
    fontSize: '1.2rem',
    textAlign: 'center',
  },
  // ポリゴン関連スタイル
  polygonSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  polygonPoint: {
    position: 'absolute',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'translate(-50%, -50%)',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    cursor: 'grab',
    border: '2px solid white',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    zIndex: 60,
    touchAction: 'none',
  },
  drawModeSelector: {
    padding: '10px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  drawModeLabel: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#333',
    display: 'block',
    marginBottom: '8px',
  },
  drawModeButtons: {
    display: 'flex',
    gap: '8px',
  },
  drawModeButton: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '0.9rem',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  polygonControls: {
    padding: '10px',
    backgroundColor: '#fff3e0',
    borderRadius: '8px',
    border: '2px solid #ff9800',
  },
  polygonInfo: {
    margin: '0 0 10px 0',
    fontSize: '0.85rem',
    color: '#e65100',
  },
  polygonButtons: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  polygonControlButton: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  polygonFinishButton: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
