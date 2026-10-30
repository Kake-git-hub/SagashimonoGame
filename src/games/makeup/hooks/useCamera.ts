import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraError, CameraErrorKind, startCamera, stopStream } from '../services/camera';

export type CameraStatus = 'idle' | 'starting' | 'running' | 'error';

export interface CameraHandle {
  status: CameraStatus;
  stream: MediaStream | null;
  error: CameraErrorKind | null;
  start: () => Promise<boolean>;
  stop: () => void;
}

/**
 * インカメラの状態管理
 * - start() で許可を求めて開始、stop() で必ずトラックを止める
 * - 画面が裏に回ったら止め、戻ってきたら再開する（iOS は裏でカメラが止まるため）
 * - 他のアプリに取られるなどでトラックが終わったら、自動で 1 回つなぎ直す
 */
export function useCamera(): CameraHandle {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wantedRef = useRef(false);   // ユーザーがカメラを使いたい状態か
  const attemptRef = useRef(0);      // 古い start() の結果を無視するための番号

  const release = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    wantedRef.current = true;
    const attempt = ++attemptRef.current;
    setStatus('starting');
    setError(null);
    try {
      const next = await startCamera();
      if (attempt !== attemptRef.current || !wantedRef.current) {
        stopStream(next);
        return false;
      }
      stopStream(streamRef.current);
      streamRef.current = next;
      setStream(next);
      setStatus('running');
      return true;
    } catch (err) {
      if (attempt !== attemptRef.current) return false;
      setError(err instanceof CameraError ? err.kind : 'unknown');
      setStatus('error');
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    attemptRef.current++;
    release();
    setStatus('idle');
  }, [release]);

  // トラックが外から止められたら（他アプリ・OS）つなぎ直す
  useEffect(() => {
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    const onEnded = () => {
      if (!wantedRef.current || streamRef.current !== stream) return;
      release();
      setStatus('starting');
      window.setTimeout(() => { if (wantedRef.current && !streamRef.current) start(); }, 500);
    };
    tracks.forEach(t => t.addEventListener('ended', onEnded));
    return () => tracks.forEach(t => t.removeEventListener('ended', onEnded));
  }, [stream, release, start]);

  // 裏に回ったら止め、戻ったら再開
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (streamRef.current) {
          release();
          if (wantedRef.current) setStatus('starting');
        }
      } else if (wantedRef.current && !streamRef.current) {
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [release, start]);

  // 画面を離れるときに必ず止める
  useEffect(() => () => {
    wantedRef.current = false;
    attemptRef.current++;
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  return { status, stream, error, start, stop };
}
