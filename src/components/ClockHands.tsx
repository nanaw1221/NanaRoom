/**
 * 完整时钟组件 - 米棕木质感风格，与房间统一
 *
 * 画布基准尺寸 = 背景图真实分辨率：1501 × 1048
 */

import type { WeatherType } from '../types/records';
import type { TimePhase } from '../hooks/useWindowState';

interface ClockHandsProps {
  now: Date;
  weather: WeatherType;  // 新增：天气（晴天/雨天）
  timePhase: TimePhase;  // 新增：昼夜时段（白天/夜晚/早晨/日落/中午/下午）
}

const CLOCK_CX = 1251;
const CLOCK_CY = 91;
const CLOCK_R = 44;  // 时钟外圆半径（已缩小）

/*
 * 颜色策略 v3（彻底解决"颜色突兀"问题）：
 *
 * ❌ 用户反馈突兀的根因：
 *    之前 WALL = #E4D6C0（晴天白天的浅米黄墙色）写死了，
 *    但背景图有 4 种（晴日/雨日/晴夜/雨夜），每种墙面色完全不同，
 *    用"浅米黄遮罩"画在"深紫墙"上 → 像一块突兀的圆形浅色补丁 ✗
 *
 * ✅ 现在做法（动态匹配真实墙面色）：
 *    1. 根据 weather + timePhase 算出「当前背景图真实的墙面色 wallHex」
 *    2. 遮罩 wallBase 就用这个真实色画 → 和墙面 100% 一色，补丁完全隐形
 *    3. 内部所有颜色按「原色 × 22% + 真实墙面色 × 78%」混合 → 时钟本身也融入墙面
 *    4. 全程不透明 opacity=1，绝不透出下层原图的时钟
 */

// 4 种背景图对应的"墙面基准色"（根据用户截图里深紫墙 + 已知晴日米黄墙设定，需要时可微调）
const WALL_PALETTE: Record<string, number> = {
  // --- 晴天白天（ RoomSVG ）：米黄米色墙 ---
  'sunny-day':   0xE4D6C0,
  // --- 晴天夜晚（ room-window-sunny-night.png ）：深紫灰墙 ---
  'sunny-night': 0x6D5C70,
  // --- 雨天白天（ room-window-rainy-day.png ）：深紫棕墙（就是用户截图里的颜色！）---
  'rainy-day':   0x6F5C6A,
  // --- 雨天夜晚（ room-window-rainy-night.png ）：更深棕紫 ---
  'rainy-night': 0x564855,
};

// 视觉亮度系数（越接近 0 越淡，越融入墙面；1 就是原色很突兀）
const BRIGHT_RATIO = 0.20;

// --- 辅助：hex 字符串和数字互转 ---
const toCss = (n: number): string =>
  `#${n.toString(16).padStart(6, '0')}`;
const mixWith = (hex: number, wall: number, ratio: number = BRIGHT_RATIO): string => {
  const r = Math.round(((hex >> 16) & 0xFF) * ratio + ((wall >> 16) & 0xFF) * (1 - ratio));
  const g = Math.round(((hex >> 8)  & 0xFF) * ratio + ((wall >> 8)  & 0xFF) * (1 - ratio));
  const b = Math.round(( hex        & 0xFF) * ratio + ( wall        & 0xFF) * (1 - ratio));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
};

const ClockHands = ({ now, weather, timePhase }: ClockHandsProps) => {
  // --- v3 关键：根据当前天气 + 昼夜算出匹配背景图的真实墙面色 ---
  const sceneKey = `${weather}-${timePhase === 'night' ? 'night' : 'day'}` as const;
  const wallHex = WALL_PALETTE[sceneKey] ?? WALL_PALETTE['sunny-day'];

  // 用动态 wallHex 实时计算本帧所有颜色（不再写死一套）
  const COLORS = {
    // ★ 遮罩：直接用真实墙面色 → 和墙面 100% 一色，补丁完全消失
    wallBase:   toCss(wallHex),
    // 木质调（和真实墙面 80% 混合 → 融入）
    frameDark:  mixWith(0x5A4A3A, wallHex),
    frameMid:   mixWith(0x6A5A48, wallHex),
    frameLight: mixWith(0x7A6A58, wallHex),
    // 表盘（和真实墙面高度融合，几乎就是墙面）
    face:       mixWith(0xC4B8A4, wallHex, 0.16),  // 表盘更淡一点
    faceShade:  mixWith(0xB0A490, wallHex, 0.22),
    // 刻度
    tick:       mixWith(0x8A7A64, wallHex),
    tickMajor:  mixWith(0x6A5A44, wallHex),
    // 数字
    number:     mixWith(0x4A3E2C, wallHex, 0.30),  // 数字稍比整体亮一点，能看清但不突兀
    // 指针
    handDark:   mixWith(0x4A3E2C, wallHex, 0.28),  // 时针分针稍清
    secondHand: mixWith(0x7A4228, wallHex, 0.32),  // 秒针再清一点
    // 中心
    center:     mixWith(0x5A4A3A, wallHex),
    centerInner:mixWith(0x7A4228, wallHex, 0.32),
    // 阴影（也按真实墙色调成深墙阴影，不是米棕阴影）
    shadow:     `rgba(0, 0, 0, ${Number((0.06 * BRIGHT_RATIO / 0.22).toFixed(3))})`,
  } as const;
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const hourLen = CLOCK_R * 0.45;
  const minLen = CLOCK_R * 0.65;
  const secLen = CLOCK_R * 0.76;

  const hourX = CLOCK_CX + hourLen * Math.cos(toRad(hourAngle - 90));
  const hourY = CLOCK_CY + hourLen * Math.sin(toRad(hourAngle - 90));
  const minX = CLOCK_CX + minLen * Math.cos(toRad(minuteAngle - 90));
  const minY = CLOCK_CY + minLen * Math.sin(toRad(minuteAngle - 90));
  const secX = CLOCK_CX + secLen * Math.cos(toRad(secondAngle - 90));
  const secY = CLOCK_CY + secLen * Math.sin(toRad(secondAngle - 90));

  // 60 个刻度
  const tickDots = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 - 90) * Math.PI / 180;
    const isMajor = i % 5 === 0;
    const r = CLOCK_R * (isMajor ? 0.86 : 0.91);
    return {
      x: CLOCK_CX + r * Math.cos(angle),
      y: CLOCK_CY + r * Math.sin(angle),
      size: isMajor ? 2.8 : 1.4,
      isMajor,
    };
  });

  // 数字位置
  const numbers = [12, 3, 6, 9].map((num) => {
    const angle = (num * 30 - 90) * Math.PI / 180;
    const r = CLOCK_R * 0.62;
    return {
      num,
      x: CLOCK_CX + r * Math.cos(angle),
      y: CLOCK_CY + r * Math.sin(angle),
    };
  });

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[6]"
      viewBox="0 0 1501 1048"
      preserveAspectRatio="xMidYMid meet"
      // ★ 关键：外层不再设 opacity（否则透出下层背景图的时钟）
      // 所有"变暗"效果通过 COLORS 里的 wallBase 遮罩 + 颜色内混实现
    >
      {/* ★ 第 0 层：墙面色遮罩（比外框更大一圈），100% 盖住背景图里原本印的时钟 */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r={CLOCK_R + 12}
        fill={COLORS.wallBase}
      />
      {/* 柔和阴影（颜色也已对应变暗） */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY + 3}
        r={CLOCK_R + 5}
        fill={COLORS.shadow}
      />

      {/* 外框（木质深色） */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r={CLOCK_R + 4}
        fill={COLORS.frameDark}
      />

      {/* 外框中色层 */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r={CLOCK_R + 2}
        fill={COLORS.frameMid}
      />

      {/* 表盘（米白色，盖住背景图原时钟） */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r={CLOCK_R}
        fill={COLORS.face}
      />

      {/* 表盘内圈装饰环 */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r={CLOCK_R - 4}
        fill="none"
        stroke={COLORS.faceShade}
        strokeWidth="1.5"
      />

      {/* 60 刻度圆点 */}
      {tickDots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={dot.size}
          fill={dot.isMajor ? COLORS.tickMajor : COLORS.tick}
        />
      ))}

      {/* 数字 */}
      {numbers.map(({ num, x, y }) => (
        <text
          key={num}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={COLORS.number}
          fontSize={CLOCK_R * 0.18}
          fontWeight="600"
          fontFamily="'Fredoka', 'Nunito', 'PingFang SC', sans-serif"
        >
          {num}
        </text>
      ))}

      {/* 时针（粗短） */}
      <line
        x1={CLOCK_CX}
        y1={CLOCK_CY}
        x2={hourX}
        y2={hourY}
        stroke={COLORS.handDark}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* 分针（中长） */}
      <line
        x1={CLOCK_CX}
        y1={CLOCK_CY}
        x2={minX}
        y2={minY}
        stroke={COLORS.handDark}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* 秒针（细长暖橙） */}
      <line
        x1={CLOCK_CX}
        y1={CLOCK_CY}
        x2={secX}
        y2={secY}
        stroke={COLORS.secondHand}
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* 中心点外圈 */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r="7"
        fill={COLORS.frameMid}
        stroke={COLORS.frameDark}
        strokeWidth="1.2"
      />

      {/* 中心点内圈 */}
      <circle
        cx={CLOCK_CX}
        cy={CLOCK_CY}
        r="3"
        fill={COLORS.centerInner}
      />
    </svg>
  );
};

export default ClockHands;
