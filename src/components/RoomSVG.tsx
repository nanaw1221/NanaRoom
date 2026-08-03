import { useState } from 'react';

/**
 * 房间背景图组件
 *
 * 只显示固定的背景图，窗外景色由 WindowSky 组件处理
 */

const RoomSVG = () => {
  const [pathIndex, setPathIndex] = useState(0);

  // 背景图候选路径
  const candidates = [
    '/room-bg.png',
    '/room-bg.jpg',
    '/room-bg.jpeg',
    '/room-bg.webp',
  ];
  const src = candidates[Math.min(pathIndex, candidates.length - 1)];

  const handleError = () => {
    if (pathIndex < candidates.length - 1) {
      setPathIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ borderRadius: '20px' }}>
      <img
        key={src}
        src={src}
        alt="房间背景"
        className="w-full h-full object-contain"
        draggable={false}
        onError={handleError}
      />
    </div>
  );
};

export default RoomSVG;
