import { useEffect } from 'react';

export type StageSource =
  | { kind: 'camera'; stream: MediaStream | null }
  | { kind: 'photo'; url: string };

interface Props {
  source: StageSource;
  mirrored: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  // 置き場の要素（画面の位置の計算と、映像をずらす CSS 変数の置き場所に使う）
  stageRef?: React.RefObject<HTMLDivElement | null>;
  // 映像（または写真）の実サイズが分かった / 変わったとき
  onFrameSize?: (width: number, height: number) => void;
  // 映像の上に重ねるもの（メイク描画・ガイド描画の canvas、状態表示）
  children?: React.ReactNode;
}

/**
 * カメラ映像（または写真）と、その上に重ねる canvas の置き場
 * 鏡像は CSS の transform で行い、重ねる canvas にも同じ変換が掛かるので座標はそのまま使える
 */
export function StageView({ source, mirrored, videoRef, imageRef, stageRef, onFrameSize, children }: Props) {
  const stream = source.kind === 'camera' ? source.stream : null;
  const photoUrl = source.kind === 'photo' ? source.url : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (stream) video.play().catch(() => { /* 自動再生が拒否されたら次の操作で再生される */ });
  }, [stream, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onFrameSize || photoUrl) return;
    const report = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) onFrameSize(video.videoWidth, video.videoHeight);
    };
    report();
    video.addEventListener('loadedmetadata', report);
    video.addEventListener('resize', report);
    return () => {
      video.removeEventListener('loadedmetadata', report);
      video.removeEventListener('resize', report);
    };
  }, [videoRef, onFrameSize, stream, photoUrl]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img || !onFrameSize || !photoUrl) return;
    const report = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) onFrameSize(img.naturalWidth, img.naturalHeight);
    };
    if (img.complete) report();
    img.addEventListener('load', report);
    return () => img.removeEventListener('load', report);
  }, [imageRef, onFrameSize, photoUrl]);

  return (
    <div ref={stageRef} className={`mmm-stage${mirrored ? ' mmm-mirrored' : ''}`}>
      {photoUrl ? (
        <img ref={imageRef} className="mmm-video" src={photoUrl} alt="" />
      ) : (
        <video
          ref={videoRef}
          className="mmm-video"
          playsInline
          muted
          autoPlay
          disablePictureInPicture
          controls={false}
          // 一部の Android ブラウザが動画を勝手に全画面にしないように
          {...{ 'webkit-playsinline': 'true', 'x5-playsinline': 'true', controlsList: 'nofullscreen nodownload' }}
        />
      )}
      {children}
    </div>
  );
}
