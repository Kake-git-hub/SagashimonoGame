import { useEffect } from 'react';

interface Props {
  stream: MediaStream | null;
  mirrored: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  // 映像の実サイズが分かった / 変わったとき（端末の向きが変わったときなど）
  onVideoSize?: (width: number, height: number) => void;
  // 映像の上に重ねるもの（メイク描画・ガイド描画の canvas）
  children?: React.ReactNode;
}

/**
 * カメラ映像と、その上に重ねる canvas の置き場
 * 鏡像は CSS の transform で行い、重ねる canvas にも同じ変換が掛かるので座標はそのまま使える
 */
export function CameraView({ stream, mirrored, videoRef, onVideoSize, children }: Props) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (stream) video.play().catch(() => { /* 自動再生が拒否されたら次の操作で再生される */ });
  }, [stream, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onVideoSize) return;
    const report = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) onVideoSize(video.videoWidth, video.videoHeight);
    };
    report();
    video.addEventListener('loadedmetadata', report);
    video.addEventListener('resize', report);
    return () => {
      video.removeEventListener('loadedmetadata', report);
      video.removeEventListener('resize', report);
    };
  }, [videoRef, onVideoSize, stream]);

  return (
    <div className={`mmm-stage${mirrored ? ' mmm-mirrored' : ''}`}>
      <video ref={videoRef} className="mmm-video" playsInline muted autoPlay />
      {children}
    </div>
  );
}
