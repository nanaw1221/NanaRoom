import type { WeatherType, RecordCategory } from '../types/records';
import type { TimePhase } from '../hooks/useWindowState';
import { motion } from 'framer-motion';
import RoomSVG from './RoomSVG';
import Hotspot from './Hotspot';
import LightingOverlay from './LightingOverlay';
import ClockHands from './ClockHands';
import WindowSky, { getWindowImage } from './WindowSky';

interface HotspotDef {
  id: string;
  label: string;
  category: RecordCategory;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
   * 画布基准尺寸 = 用户图片真实分辨率：1501 × 1048
   *
   * 2026-08-01 交互式校准工具导出精确坐标：
   */
  const hotspotDefs: HotspotDef[] = [
    // ★ movies（33 条电影）绑定投影仪：显著扩大热点区域（原来 165×140 → 现在 280×200），
    //   向左+向下延伸，覆盖投影仪+投影幕布上方大片天花板，一点就中
    { id: 'projector', label: '🎬 投影仪 · 电影(33)', category: 'movies',    x: 620,  y: 10,  width: 280, height: 200 },
    { id: 'bookshelf', label: '📚 书架 · 读书',       category: 'books',     x: 1060, y: 600, width: 400, height: 210 },
    // ★ albums（9 条专辑）扩大热点（原 361×197 → 410×240），向左+向下延伸，降低点中门槛
    { id: 'albums',    label: '💿 专辑柜 · 专辑(9)',  category: 'albums',    x: 1060, y: 380, width: 410, height: 240 },
    { id: 'notebook',  label: '📓 笔记本 · 写下的',   category: 'notes',     x: 370,  y: 490, width: 170, height: 120 },
    // ★ 展板上的旅行/演唱会也显著扩大（原 71×42 / 122×61 → 大一圈），点展板附近就触发
    { id: 'travel',    label: '✈️ 明信片 · 旅行',     category: 'travel',    x: 1230, y: 190, width: 130, height: 90  },
    { id: 'concerts',  label: '🎫 机票 · 演唱会',     category: 'concerts',  x: 1100, y: 225, width: 180, height: 100 },
  ];

interface RoomSceneProps {
  weather: WeatherType;
  timePhase: TimePhase;
  now: Date;
  hoveredId: string | null;
  onHotspotClick: (category: RecordCategory) => void;
  onHotspotHover: (id: string | null) => void;
  // --- 对齐/位置控制（从 Header 校准面板读出来传给 RoomScene）---
  roomAlignX?: number;          // 0=贴左（靠近标题） 1=居中 2=贴右
  roomMaxW?: number;            // max-width 像素（默认 1100）
  roomOffsetXPx?: number;       // 额外横向微调（+右 -左）
  roomContentGapXPx?: number;   // 与标题栏之间的间隙 px（负值=重叠）
  // --- 新增：点击窗户时的回调（用于切换天气）---
  onWindowClick?: () => void;
}

// 画布真实尺寸（背景图原始尺寸 1501×1048）
const CANVAS_W = 1501;
const CANVAS_H = 1048;

/*
 * 窗户整体点击区域（比玻璃区域再往外扩大一圈，把窗框也包含进来，
 * 让用户点击"窗户"视觉范围内的任何地方都能切换天气，更顺手）
 *
 * 四块玻璃坐标（来自 Calibrator.tsx）：
 *   pane1: x=41   y=40   w=176 h=276
 *   pane2: x=238  y=40   w=176 h=276
 *   pane3: x=41   y=337  w=176 h=267
 *   pane4: x=238  y=337  w=176 h=267
 * → 玻璃总体范围：x=41~414 (=238+176),  y=40~604 (=337+267)
 * → 扩大 20px，覆盖窗框：x=21~434, y=20~624
 */
const WINDOW_HOTSPOT = {
  x: 21,
  y: 20,
  w: 434 - 21,
  h: 624 - 20,
};

const RoomScene = ({
  weather,
  timePhase,
  now,
  hoveredId,
  onHotspotClick,
  onHotspotHover,
  roomAlignX = 1,            // 默认 1=居中（旧行为不变）
  roomMaxW = 1100,           // 默认 1100px（旧行为不变）
  roomOffsetXPx = 0,         // 默认 0
  roomContentGapXPx = 0,     // 默认 0
  onWindowClick,             // 新增：点击窗户回调
}: RoomSceneProps) => {
  // 获取当前天气对应的图片
  const weatherImage = getWindowImage(timePhase, weather);

  // 计算外边距 + 额外偏移
  const wrapperStyle: React.CSSProperties = {
    maxWidth: `${roomMaxW}px`,
    aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
  };
  if (roomAlignX === 0) {
    // 贴左：左边 = 标题- 标题栏间隙 + 标题栏宽/对齐：
    // → marginLeft = gap（与标题栏的间距） + offsetX（额外微调）
    wrapperStyle.marginLeft = `${roomContentGapXPx + roomOffsetXPx}px`;
    wrapperStyle.marginRight = 'auto';
  } else if (roomAlignX === 2) {
    // 贴右：右边留 gap
    wrapperStyle.marginLeft = 'auto';
    wrapperStyle.marginRight = `${roomContentGapXPx - roomOffsetXPx}px`;
  } else {
    // 居中（旧行为），并用 translateX 做整体微调
    wrapperStyle.marginLeft = 'auto';
    wrapperStyle.marginRight = 'auto';
    if (roomOffsetXPx !== 0) wrapperStyle.transform = `translateX(${roomOffsetXPx}px)`;
  }

  return (
    <div className="relative w-full" style={wrapperStyle}>
      {/* 1. 背景图：晴天白天用 RoomSVG，其他天气用 WindowSky */}
      {weatherImage ? <WindowSky weather={weather} timePhase={timePhase} /> : <RoomSVG />}
      {/* 2. 整体环境光叠层（色温/晕染/灯光，z-[4]） */}
      <LightingOverlay weather={weather} timePhase={timePhase} />
      {/* 3. 时钟指针（z-[6] 高于光照层） */}
      <ClockHands now={now} weather={weather} timePhase={timePhase} />

      {/* 4. 窗户点击热区（和其他 Hotspot 完全一致：静默无提示，无 hover 微亮，无文字，不画框） */}
      {onWindowClick && (
        <motion.div
          className="absolute z-[5]"
          style={{
            left: `${(WINDOW_HOTSPOT.x / CANVAS_W) * 100}%`,
            top: `${(WINDOW_HOTSPOT.y / CANVAS_H) * 100}%`,
            width: `${(WINDOW_HOTSPOT.w / CANVAS_W) * 100}%`,
            height: `${(WINDOW_HOTSPOT.h / CANVAS_H) * 100}%`,
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
          onClick={onWindowClick}
          whileHover={{ scale: 1 }}
          whileTap={{ scale: 0.992 }}
        />
      )}

      {/* 热点区域 */}
      {hotspotDefs.map((hs) => (
        <Hotspot
          key={hs.id}
          id={hs.id}
          label={hs.label}
          x={hs.x}
          y={hs.y}
          width={hs.width}
          height={hs.height}
          isHovered={hoveredId === hs.id}
          onClick={() => onHotspotClick(hs.category)}
          onHover={onHotspotHover}
        />
      ))}
    </div>
  );
};

export default RoomScene;
