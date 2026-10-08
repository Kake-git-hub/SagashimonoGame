import { useCallback, useEffect, useState } from 'react';
import { NejiCollectionMap, NejiProgressMap, Stage, StageSummary } from './types';
import { fetchStage, fetchStageList } from './services/stageService';
import { addToCollection, getNejiCollection, getNejiProgress, markStageCleared } from './services/nejiStorageService';
import { adjustStageForAge } from './logic/normalize';
import { StageList } from './components/StageList';
import { NejiGameScreen } from './components/NejiGameScreen';
import { CollectionScreen } from './components/CollectionScreen';
import { TreasureResult } from './components/ResultOverlay';
import { useQuizGate } from '../../hooks/useQuizGate';
import { difficultyForAge, getCurrentProfile } from '../../services/profileService';

interface Props {
  // ホーム画面（ゲーム選択）へ戻る
  onExit: () => void;
}

/**
 * ネジはずしゲーム本体
 * ステージ一覧 / たからばこ / ゲーム画面 の切り替えを担当する
 */
export default function NejiApp({ onExit }: Props) {
  const [stages, setStages] = useState<StageSummary[]>([]);
  const [progress, setProgress] = useState<NejiProgressMap>(() => getNejiProgress());
  const [collection, setCollection] = useState<NejiCollectionMap>(() => getNejiCollection());
  const [stage, setStage] = useState<Stage | null>(null);
  const [stageIndex, setStageIndex] = useState(-1);
  const [showCollection, setShowCollection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const quiz = useQuizGate();

  // ステージ一覧を読み込む
  useEffect(() => {
    fetchStageList()
      .then(setStages)
      .catch(err => setError(err instanceof Error ? err.message : 'エラーが発生しました'))
      .finally(() => setLoading(false));
  }, []);

  // ステージを選択（年齢に合わせておきば・ボックスを補正する）
  const handleSelectStage = useCallback(async (stageId: string) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchStage(stageId);
      const profile = getCurrentProfile();
      setStage(profile ? adjustStageForAge(loaded, difficultyForAge(profile.age)) : loaded);
      setStageIndex(stages.findIndex(s => s.id === stageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [stages]);

  // 一覧に戻る
  const handleBackToList = useCallback(() => {
    setStage(null);
    setStageIndex(-1);
    setProgress(getNejiProgress());
    setCollection(getNejiCollection());
  }, []);

  // クリアを記録（たからものがあればコレクションへ）
  const handleCleared = useCallback((stageId: string, moves: number): TreasureResult | null => {
    markStageCleared(stageId, moves);
    setProgress(getNejiProgress());
    const treasure = stage?.treasure;
    if (!treasure || stage.id !== stageId) return null;
    const isNew = addToCollection(treasure.id, stageId);
    setCollection(getNejiCollection());
    return { name: treasure.name, emoji: treasure.emoji, isNew };
  }, [stage]);

  // 次のステージへ（親の設定によってはクイズに正解してから）
  const hasNextStage = stageIndex >= 0 && stageIndex < stages.length - 1;
  const handleNextStage = useCallback(async () => {
    if (!hasNextStage) return;
    if (!(await quiz.ask('nextStage'))) return;
    handleSelectStage(stages[stageIndex + 1].id);
  }, [hasNextStage, handleSelectStage, stages, stageIndex, quiz]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>よみこみちゅう...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <p>{error}</p>
        <button onClick={stage ? handleBackToList : onExit}>もどる</button>
      </div>
    );
  }

  if (stage) {
    return (
      <>
        <NejiGameScreen
          stage={stage}
          hasNextStage={hasNextStage}
          quiz={quiz}
          onBack={handleBackToList}
          onNextStage={handleNextStage}
          onCleared={handleCleared}
        />
        {quiz.overlay}
      </>
    );
  }

  if (showCollection) {
    return <CollectionScreen stages={stages} collection={collection} onBack={() => setShowCollection(false)} />;
  }

  return (
    <StageList
      stages={stages}
      progress={progress}
      collection={collection}
      onSelect={handleSelectStage}
      onOpenCollection={() => setShowCollection(true)}
      onExit={onExit}
    />
  );
}
