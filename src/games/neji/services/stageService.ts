import { Stage, StageDef, StageSummary } from '../types';
import { normalizeStage } from '../logic/normalize';

const BASE_URL = import.meta.env.BASE_URL;

// ステージ一覧を取得
export async function fetchStageList(): Promise<StageSummary[]> {
  const response = await fetch(`${BASE_URL}neji/index.json`);
  if (!response.ok) {
    throw new Error('ステージ一覧の取得に失敗しました');
  }
  return response.json();
}

// ステージ定義を取得（既定値を埋めて返す）
export async function fetchStage(id: string): Promise<Stage> {
  const response = await fetch(`${BASE_URL}neji/stages/${encodeURIComponent(id)}.json`);
  if (!response.ok) {
    throw new Error(`ステージ "${id}" の取得に失敗しました`);
  }
  const def: StageDef = await response.json();
  return normalizeStage(def);
}
