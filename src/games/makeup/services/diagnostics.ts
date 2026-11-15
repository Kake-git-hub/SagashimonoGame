/**
 * 開発用の記録（足あと）の出口
 * マジックメイクミラーの中からは diag() を呼ぶだけにして、記録の保存先はプラットフォーム側（MakeupApp の onDebugLog）に任せる。
 * 実機で落ちたときに「どこまで進んでいたか」を残すためのもので、重い処理の前後・状態の変わり目で呼ぶ。
 * 映像や顔の点そのものは渡さない（大きさ・時間・件数などの数字だけ）
 */
export type DiagnosticsSink = (message: string, data?: unknown, replaceKey?: string) => void;

let sink: DiagnosticsSink | null = null;

export function setDiagnosticsSink(next: DiagnosticsSink | null): void {
  sink = next;
}

/**
 * @param replaceKey 同じキーの記録が続いたら上書きする（定期的な状態の記録用）
 */
export function diag(message: string, data?: unknown, replaceKey?: string): void {
  try {
    sink?.(message, data, replaceKey);
  } catch {
    // 記録に失敗しても動作は続ける
  }
}
