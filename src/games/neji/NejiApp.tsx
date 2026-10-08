import { useCallback, useEffect, useState } from 'react';
import { NejiProgressMap, Stage, StageSummary } from './types';
import { fetchStage, fetchStageList } from './services/stageService';
import { getNejiProgress, markStageCleared } from './services/nejiStorageService';
import { StageList } from './components/StageList';
import { NejiGameScreen } from './components/NejiGameScreen';

interface Props {
  // ホーム画面（ゲーム選択）へ戻る
  onExit: () => void;
}

/**
 * ネジはずしゲーム本体
 * ステージ一覧 / ゲーム画面 の切り替えを担当する
 */
export default function NejiApp({ onExit }: Props) {
  const [stages, setStages] = useState<StageSummary[]>([]);
  const [progress, setProgress] = useState<NejiProgressMap>(() => getNejiProgress());
  const [stage, setStage] = useState<Stage | null>(null);
  const [stageIndex, setStageIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ステージ一覧を読み込む
  useEffect(() => {
    fetchStageList()
      .then(setStages)
      .catch(err => setError(err instanceof Error ? err.message : 'エラーが発生しました'))
      .finally(() => setLoading(false));
  }, []);

  // ステージを選択
  const handleSelectStage = useCallback(async (stageId: string) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchStage(stageId);
      setStage(loaded);
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
  }, []);

  // クリアを記録
  const handleCleared = useCallback((stageId: string, moves: number) => {
    markStageCleared(stageId, moves);
    setProgress(getNejiProgress());
  }, []);

  // 次のステージへ
  const hasNextStage = stageIndex >= 0 && stageIndex < stages.length - 1;
  const handleNextStage = useCallback(() => {
    if (!hasNextStage) return;
    handleSelectStage(stages[stageIndex + 1].id);
  }, [hasNextStage, handleSelectStage, stages, stageIndex]);

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
      <NejiGameScreen
        stage={stage}
        hasNextStage={hasNextStage}
        onBack={handleBackToList}
        onNextStage={handleNextStage}
        onCleared={handleCleared}
      />
    );
  }

  return (
    <StageList
      stages={stages}
      progress={progress}
      onSelect={handleSelectStage}
      onExit={onExit}
    />
  );
}
