import { useState, useEffect, useCallback, useRef } from 'react';
import { Puzzle, Target, CONSTANTS } from '../types';
import { useGame } from '../hooks/useGame';
import { useIsTablet } from '../hooks/useMediaQuery';
import { useSettings } from '../hooks/useSettings';
import { getImageUrl } from '../services/puzzleService';
import { generateAllThumbnails } from '../services/thumbnailService';
import { TargetList } from './TargetList';
import { TargetMarker } from './TargetMarker';
import { HintOverlay } from './HintOverlay';
import { ClearOverlay } from './ClearOverlay';
import { CollapsiblePanel } from './CollapsiblePanel';

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
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [foundAnimation, setFoundAnimation] = useState<string | null>(null);

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
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // クリック/タップ処理
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (game.isCompleted) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const img = container.querySelector('img');
    if (!img) return;

    // 画像の表示領域を計算（object-fit: contain を考慮）
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageSize.width / imageSize.height || 1;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;

    if (containerAspect > imageAspect) {
      // コンテナが横長 → 画像は高さに合わせる
      displayHeight = rect.height;
      displayWidth = displayHeight * imageAspect;
      offsetX = (rect.width - displayWidth) / 2;
      offsetY = 0;
    } else {
      // コンテナが縦長 → 画像は幅に合わせる
      displayWidth = rect.width;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (rect.height - displayHeight) / 2;
    }

    // クリック位置を取得
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // コンテナ内の相対位置
    const relX = clientX - rect.left - offsetX;
    const relY = clientY - rect.top - offsetY;

    // 画像外のクリックは無視
    if (relX < 0 || relX > displayWidth || relY < 0 || relY > displayHeight) {
      return;
    }

    // 0-1000スケールに変換
    const scaleX = (relX / displayWidth) * CONSTANTS.SCALE;
    const scaleY = (relY / displayHeight) * CONSTANTS.SCALE;

    // ターゲットチェック
    const foundTarget = game.checkTarget(scaleX, scaleY);
    if (foundTarget) {
      game.markFound(foundTarget);
      setFoundAnimation(foundTarget);
      setTimeout(() => setFoundAnimation(null), 1000);
    }
  }, [game, imageSize]);

  // ターゲットの表示位置を計算
  const getTargetPosition = useCallback((target: Target) => {
    const container = imageContainerRef.current;
    if (!container || !imageSize.width) return null;

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

    const [x, y] = target.positions[0];
    const pixelX = offsetX + (x / CONSTANTS.SCALE) * displayWidth;
    const pixelY = offsetY + (y / CONSTANTS.SCALE) * displayHeight;

    return { x: pixelX, y: pixelY };
  }, [imageSize]);

  const foundTargetsSet = new Set(game.foundTargets);

  return (
    <div style={isTablet ? styles.containerLandscape : styles.containerPortrait}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <button onClick={onBack} style={styles.backButton}>
          ← もどる
        </button>
        <h1 style={styles.puzzleTitle}>{puzzle.name}</h1>
        <div style={styles.progress}>
          {game.foundTargets.length} / {puzzle.targets.length}
        </div>
      </header>

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
            <TargetList
              targets={puzzle.targets}
              foundTargets={foundTargetsSet}
              displayMode={settings.displayMode}
              thumbnails={thumbnails}
              layout="vertical"
            />
            <button 
              onClick={game.triggerHint} 
              style={styles.hintButton}
              disabled={game.isCompleted || game.showHint}
            >
              💡 ヒント
            </button>
          </aside>
        )}

        {/* ゲーム画像 */}
        <div
          ref={imageContainerRef}
          style={styles.imageContainer}
          onClick={handleImageClick}
          onTouchStart={handleImageClick}
        >
          <img
            src={getImageUrl(puzzle.imageSrc)}
            alt={puzzle.name}
            style={styles.gameImage}
            onLoad={handleImageLoad}
            draggable={false}
          />

          {/* 発見済みマーカー */}
          {puzzle.targets.map(target => {
            if (!foundTargetsSet.has(target.title)) return null;
            const pos = getTargetPosition(target);
            if (!pos) return null;
            return (
              <TargetMarker
                key={target.title}
                x={pos.x}
                y={pos.y}
                isNew={foundAnimation === target.title}
              />
            );
          })}

          {/* ヒント表示 */}
          {game.showHint && game.hintTarget && (
            <HintOverlay
              target={puzzle.targets.find(t => t.title === game.hintTarget)!}
              getPosition={getTargetPosition}
            />
          )}
        </div>

        {/* 縦画面：下部折り畳みパネル */}
        {!isTablet && (
          <CollapsiblePanel
            title={`さがすもの (${game.foundTargets.length}/${puzzle.targets.length})`}
            extra={
              <>
                <button onClick={toggleDisplayMode} style={styles.toggleButtonSmall}>
                  {settings.displayMode === 'text' ? '🖼️' : '📝'}
                </button>
                <button 
                  onClick={game.triggerHint} 
                  style={styles.hintButtonSmall}
                  disabled={game.isCompleted || game.showHint}
                >
                  💡
                </button>
              </>
            }
          >
            <TargetList
              targets={puzzle.targets}
              foundTargets={foundTargetsSet}
              displayMode={settings.displayMode}
              thumbnails={thumbnails}
              layout="horizontal"
            />
          </CollapsiblePanel>
        )}
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
  containerLandscape: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  containerPortrait: {
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
    padding: '10px 15px',
    backgroundColor: '#16213e',
    color: 'white',
    flexShrink: 0,
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
  puzzleTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  progress: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: '5px 15px',
    borderRadius: '20px',
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
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '5px',
  },
  toggleButton: {
    padding: '5px 10px',
    fontSize: '1.2rem',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  toggleButtonSmall: {
    padding: '5px 8px',
    fontSize: '1rem',
    backgroundColor: 'rgba(255,255,255,0.2)',
    border: 'none',
    borderRadius: '6px',
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
    marginTop: 'auto',
  },
  hintButtonSmall: {
    padding: '5px 10px',
    fontSize: '1rem',
    backgroundColor: '#ffc107',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    touchAction: 'manipulation',
  },
  gameImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    userSelect: 'none',
    pointerEvents: 'none',
  },
};
