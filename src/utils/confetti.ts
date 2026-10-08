import confetti from 'canvas-confetti';

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];

// クリア時の紙吹雪（両端から 3 秒 + 中央で一発）
export function playClearConfetti(): void {
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: COLORS });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: COLORS });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();

  confetti({ particleCount: 100, spread: 70, origin: { x: 0.5, y: 0.5 } });
}
