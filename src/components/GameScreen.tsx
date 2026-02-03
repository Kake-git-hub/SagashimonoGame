import { useState, useEffect, useCallback, useRef } from 'react';
import { Puzzle, CONSTANTS, makePositionKey, getTotalPositionCount, normalizePosition, Position, MarkerSize } from '../types';
import { useGame } from '../hooks/useGame';
import { useIsTablet } from '../hooks/useMediaQuery';
import { useSettings } from '../hooks/useSettings';
import { getImageUrl } from '../services/puzzleService';
import { generateAllThumbnails } from '../services/thumbnailService';
import { TargetList } from './TargetList';
import { TargetMarker } from './TargetMarker';
import { HintOverlay } from './HintOverlay';
import { ClearOverlay } from './ClearOverlay';

interface Props {
  puzzle: Puzzle;
  onBack: () => void;
  onNextPuzzle: () => void;
  hasNextPuzzle: boolean;
}

export function GameScreen({ puzzle, onBack, onNextPuzzle, hasNextPuzzle }: Props) {
  const isTablet = useIsTablet();
  const { settings, toggleDisplayMode } = useSettings();
  const game = useGame(puzzle);
  
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [foundAnimation, setFoundAnimation] = useState<string | null>(null);

  // ズーム関連の状態
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastTouchRef = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const lastClickTimeRef = useRef(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // サムネイル生成
  useEffect(() => {
    if (settings.displayMode === 'thumbnail' && puzzle) {
      const imageUrl = getImageUrl(puzzle.imageSrc);
      generateAllThumbnails(imageUrl, puzzle.targets).then(setThumbnails);
    }
  }, [puzzle, settings.displayMode]);

  // 画像サイズを取得
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight, displayWidth: 0, displayHeight: 0 });
  }, []);

  // 2点間の距離を計算
  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 2点の中心を計算
  const getCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  // ターゲットチェック共通処理（タッチハンドラーより先に定義）
  const checkTargetAt = useCallback((clientX: number, clientY: number) => {
    if (game.isCompleted) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageSize.width / imageSize.height || 1;

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

    // ズームとパンを考慮した座標変換
    const scaledWidth = displayWidth * scale;
    const scaledHeight = displayHeight * scale;
    const scaledOffsetX = offsetX + (displayWidth - scaledWidth) / 2 + position.x;
    const scaledOffsetY = offsetY + (displayHeight - scaledHeight) / 2 + position.y;

    const relX = clientX - rect.left - scaledOffsetX;
    const relY = clientY - rect.top - scaledOffsetY;

    if (relX < 0 || relX > scaledWidth || relY < 0 || relY > scaledHeight) {
      return;
    }

    const scaleX = (relX / scaledWidth) * CONSTANTS.SCALE;
    const scaleY = (relY / scaledHeight) * CONSTANTS.SCALE;

    const foundPosKey = game.checkTarget(scaleX, scaleY);
    if (foundPosKey) {
      game.markFound(foundPosKey);
      setFoundAnimation(foundPosKey);
      setTimeout(() => setFoundAnimation(null), 1000);
    }
  }, [game, imageSize, scale, position]);

  // タッチ開始
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (scale > 1) {
        isDraggingRef.current = true;
      }
    } else if (e.touches.length === 2) {
      // ピンチズーム開始
      const dist = getDistance(e.touches);
      const center = getCenter(e.touches);
      lastTouchRef.current = { x: center.x, y: center.y, dist };
      isDraggingRef.current = true;
    }
  }, [scale]);

  // タッチ移動
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!lastTouchRef.current) return;

    if (e.touches.length === 2) {
      // ピンチズーム
      e.preventDefault();
      const dist = getDistance(e.touches);
      const center = getCenter(e.touches);
      
      if (lastTouchRef.current.dist) {
        const scaleChange = dist / lastTouchRef.current.dist;
        setScale(prev => Math.min(Math.max(prev * scaleChange, 1), 5));
      }
      
      // パン（2本指でドラッグ）
      const dx = center.x - lastTouchRef.current.x;
      const dy = center.y - lastTouchRef.current.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      
      lastTouchRef.current = { x: center.x, y: center.y, dist };
      isDraggingRef.current = true;
    } else if (e.touches.length === 1 && scale > 1) {
      // 1本指でパン（ズーム中のみ）
      e.preventDefault();
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isDraggingRef.current = true;
    }
  }, [scale]);

  // タッチ終了
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) {
      // ダブルタップでズームリセット
      const now = Date.now();
      if (now - lastClickTimeRef.current < 300) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        lastTouchRef.current = null;
        touchStartPosRef.current = null;
        isDraggingRef.current = false;
        lastClickTimeRef.current = 0;
        return;
      }
      lastClickTimeRef.current = now;
      
      // シングルタップでターゲットチェック
      if (touchStartPosRef.current && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const startTouch = touchStartPosRef.current;
        const dx = touch.clientX - startTouch.x;
        const dy = touch.clientY - startTouch.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 移動距離が小さい場合のみタップとして処理
        if (distance < 15) {
          checkTargetAt(touch.clientX, touch.clientY);
        }
      }
      
      isDraggingRef.current = false;
      lastTouchRef.current = null;
      touchStartPosRef.current = null;
    } else {
      lastTouchRef.current = e.touches.length > 0 
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : null;
    }
  }, [checkTargetAt]);

  // マウスホイールでズーム（PC用）
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 1), 5);
    setScale(newScale);
    
    // ズームがリセットされたら位置もリセット
    if (newScale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // クリック処理（PC用）
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    checkTargetAt(e.clientX, e.clientY);
  }, [checkTargetAt]);

  // 表示サイズを計算して更新
  const updateDisplaySize = useCallback(() => {
    const container = imageContainerRef.current;
    if (!container || !imageSize.width) return;

    const rect = container.getBoundingClientRect();
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageSize.width / imageSize.height;

    let displayWidth: number, displayHeight: number;

    if (containerAspect > imageAspect) {
      displayHeight = rect.height;
      displayWidth = displayHeight * imageAspect;
    } else {
      displayWidth = rect.width;
      displayHeight = displayWidth / imageAspect;
    }

    setImageSize(prev => ({ ...prev, displayWidth, displayHeight }));
  }, [imageSize.width, imageSize.height]);

  // リサイズ時に表示サイズを更新
  useEffect(() => {
    updateDisplaySize();
    window.addEventListener('resize', updateDisplaySize);
    return () => window.removeEventListener('resize', updateDisplaySize);
  }, [updateDisplaySize]);

  // 座標から表示位置を計算（ズーム対応）
  const getPixelPosition = useCallback((x: number, y: number, offset?: [number, number]) => {
    const container = imageContainerRef.current;
    if (!container || !imageSize.width || !imageSize.displayWidth) return null;

    const rect = container.getBoundingClientRect();
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageSize.width / imageSize.height;

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

    // ズームとパンを考慮
    const scaledWidth = displayWidth * scale;
    const scaledHeight = displayHeight * scale;
    const scaledOffsetX = offsetX + (displayWidth - scaledWidth) / 2 + position.x;
    const scaledOffsetY = offsetY + (displayHeight - scaledHeight) / 2 + position.y;

    const finalX = x + (offset ? offset[0] : 0);
    const finalY = y + (offset ? offset[1] : 0);
    const pixelX = scaledOffsetX + (finalX / CONSTANTS.SCALE) * scaledWidth;
    const pixelY = scaledOffsetY + (finalY / CONSTANTS.SCALE) * scaledHeight;

    return { x: pixelX, y: pixelY };
  }, [imageSize, scale, position]);

  // ズームリセット
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 進捗計算
  const totalPositions = getTotalPositionCount(puzzle);
  const foundCount = game.foundPositions.size;

  // 発見済み位置のマーカーを生成
  const foundMarkers: { key: string; x: number; y: number; size: MarkerSize }[] = [];
  for (const target of puzzle.targets) {
    for (let i = 0; i < target.positions.length; i++) {
      const posKey = makePositionKey(target.title, i);
      if (game.foundPositions.has(posKey)) {
        const pos = normalizePosition(target.positions[i] as Position | [number, number]);
        foundMarkers.push({
          key: posKey,
          x: pos.x,
          y: pos.y,
          size: pos.size,
        });
      }
    }
  }

  return (
    <div style={styles.container}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ← もどる
        </button>
        <h1 style={styles.puzzleTitle}>{puzzle.name}</h1>
        <div style={styles.progress}>
          {foundCount} / {totalPositions}
        </div>
      </header>

      {/* 縦画面：上部お題バー */}
      {!isTablet && (
        <div style={styles.topBar}>
          <div style={styles.topBarScroll}>
            <TargetList
              targets={puzzle.targets}
              foundPositions={game.foundPositions}
              displayMode={settings.displayMode}
              thumbnails={thumbnails}
              layout="horizontal"
              compact
            />
          </div>
          <div style={styles.topBarButtons}>
            <button onClick={toggleDisplayMode} style={styles.topBarButton}>
              {settings.displayMode === 'text' ? '🖼️' : '📝'}
            </button>
            <button 
              onClick={game.triggerHint} 
              style={styles.topBarButton}
              disabled={game.isCompleted || game.showHint}
            >
              💡
            </button>
            {scale > 1 && (
              <button onClick={resetZoom} style={styles.topBarButton}>
                🔍
              </button>
            )}
          </div>
        </div>
      )}

      <div style={isTablet ? styles.mainLandscape : styles.mainPortrait}>
        {/* 横画面：左サイドバー */}
        {isTablet && (
          <aside style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <span>さがすもの</span>
              <button onClick={toggleDisplayMode} style={styles.toggleButton}>
                {settings.displayMode === 'text' ? '🖼️' : '📝'}
              </button>
            </div>
            <div style={styles.sidebarList}>
              <TargetList
                targets={puzzle.targets}
                foundPositions={game.foundPositions}
                displayMode={settings.displayMode}
                thumbnails={thumbnails}
                layout="vertical"
              />
            </div>
            <div style={styles.sidebarButtons}>
              <button 
                onClick={game.triggerHint} 
                style={styles.hintButton}
                disabled={game.isCompleted || game.showHint}
              >
                {game.hintState && game.hintState.level > 0 ? '💡 もっとヒント！' : '💡 ヒント'}
              </button>
              {scale > 1 && (
                <button onClick={resetZoom} style={styles.zoomResetButton}>
                  🔍 リセット
                </button>
              )}
            </div>
          </aside>
        )}

        {/* ゲーム画像 */}
        <div
          ref={imageContainerRef}
          style={styles.imageContainer}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <img
            src={getImageUrl(puzzle.imageSrc)}
            alt={puzzle.name}
            style={{
              ...styles.gameImage,
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />

          {/* 発見済みマーカー - 各位置ごとに表示 */}
          {foundMarkers.map(marker => {
            const pos = getPixelPosition(marker.x, marker.y);
            if (!pos) return null;
            return (
              <TargetMarker
                key={marker.key}
                x={pos.x}
                y={pos.y}
                isNew={foundAnimation === marker.key}
                size={marker.size}
              />
            );
          })}

          {/* ヒント表示 */}
          {game.showHint && game.hintTarget && game.hintState && imageSize && (
            <HintOverlay
              target={puzzle.targets.find(t => t.title === game.hintTarget)!}
              hintState={game.hintState}
              getPosition={getPixelPosition}
              scaleFactor={(imageSize.displayWidth * scale) / CONSTANTS.SCALE}
            />
          )}

          {/* ズームインジケーター */}
          {scale > 1 && (
            <div style={styles.zoomIndicator}>
              {Math.round(scale * 100)}%
            </div>
          )}
        </div>
      </div>

      {/* クリア画面 */}
      {game.isCompleted && (
        <ClearOverlay
          puzzleName={puzzle.name}
          onBack={onBack}
          onNextPuzzle={onNextPuzzle}
          onRetry={game.resetGame}
          hasNextPuzzle={hasNextPuzzle}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#16213e',
    color: 'white',
    flexShrink: 0,
  },
  backButton: {
    padding: '6px 12px',
    fontSize: '0.9rem',
    backgroundColor: 'transparent',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  puzzleTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  progress: {
    fontSize: '1rem',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '4px 12px',
    borderRadius: '20px',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#16213e',
    padding: '6px 8px',
    gap: '6px',
    flexShrink: 0,
    maxHeight: '60px',
  },
  topBarScroll: {
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },
  topBarButtons: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  topBarButton: {
    padding: '8px 12px',
    fontSize: '1.2rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  mainLandscape: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  mainPortrait: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '220px',
    backgroundColor: '#16213e',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexShrink: 0,
    overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '5px',
    flexShrink: 0,
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  sidebarButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: 'auto',
  },
  toggleButton: {
    padding: '5px 10px',
    fontSize: '1.2rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  hintButton: {
    padding: '12px',
    fontSize: '1rem',
    backgroundColor: '#ffc107',
    color: '#333',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  zoomResetButton: {
    padding: '10px',
    fontSize: '0.9rem',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    touchAction: 'none',
  },
  gameImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    userSelect: 'none',
    pointerEvents: 'none',
    transformOrigin: 'center center',
    transition: 'none',
  },
  zoomIndicator: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
  },
};
