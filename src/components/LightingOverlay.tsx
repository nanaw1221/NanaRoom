import { motion, AnimatePresence } from 'framer-motion';
import type { WeatherType } from '../types/records';
import type { TimePhase } from '../hooks/useWindowState';

interface LightingOverlayProps {
  weather: WeatherType;
  timePhase: TimePhase;
}

/**
 * 光照叠层：6 个时段 × 晴/雨 = 12 种光效
 * 每个 key 对应一组配置，Framer Motion 做平滑过渡
 *
 * 时段：
 *   sunrise  日出 05:00-07:00   → 暖橙粉，太阳低角度
 *   morning  上午 07:00-11:00   → 清爽金白
 *   noon     中午 11:00-14:00   → 明亮白光
 *   afternoon下午 14:00-17:00   → 稍暖白
 *   sunset   日落 17:00-19:30   → 金红紫橙
 *   night    夜晚 19:30-05:00   → 深蓝紫 + 室内暖色灯
 */

type PhaseKey = `${TimePhase}-${WeatherType}`;

interface PhaseStyle {
  /** 整体色温渐变（从上到下） */
  tint: string;
  /** 太阳/环境光（径向，从左上窗户方向） */
  sun?: string;
  /** 地板反光（径向，从左下） */
  floorGlow?: string;
  /** 夜晚室内灯 - 三个光点位置及颜色，{left,top,size,color,alpha} */
  lamps?: Array<{ left: string; top: string; size: string; color: string; alpha: number }>;
  /** 暗角（夜景用） */
  vignette?: string;
}

const STYLES: Record<PhaseKey, PhaseStyle> = {
  /* ========== 晴天 ========== */

  'sunrise-sunny': {
    tint: 'linear-gradient(180deg, rgba(255,180,130,0.22) 0%, rgba(255,210,170,0.12) 45%, rgba(255,230,200,0.05) 100%)',
    sun: 'radial-gradient(ellipse 60% 45% at 14% 28%, rgba(255,175,115,0.36) 0%, rgba(255,155,105,0.12) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 45% 35% at 18% 82%, rgba(255,170,120,0.12) 0%, transparent 70%)',
  },

  'morning-sunny': {
    tint: 'linear-gradient(180deg, rgba(255,230,180,0.18) 0%, rgba(255,240,210,0.08) 45%, rgba(255,245,220,0.02) 100%)',
    sun: 'radial-gradient(ellipse 55% 42% at 14% 22%, rgba(255,236,180,0.28) 0%, rgba(255,220,160,0.10) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 40% 30% at 14% 78%, rgba(255,240,200,0.10) 0%, transparent 70%)',
  },

  'noon-sunny': {
    tint: 'linear-gradient(180deg, rgba(255,248,220,0.12) 0%, rgba(255,250,230,0.05) 45%, rgba(255,252,240,0.00) 100%)',
    sun: 'radial-gradient(ellipse 52% 40% at 14% 18%, rgba(255,245,210,0.22) 0%, rgba(255,240,200,0.08) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 38% 28% at 14% 74%, rgba(255,248,220,0.08) 0%, transparent 70%)',
  },

  'afternoon-sunny': {
    tint: 'linear-gradient(180deg, rgba(255,235,190,0.16) 0%, rgba(255,240,205,0.08) 45%, rgba(255,245,215,0.02) 100%)',
    sun: 'radial-gradient(ellipse 52% 40% at 14% 24%, rgba(255,230,180,0.26) 0%, rgba(255,215,155,0.10) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 40% 30% at 14% 76%, rgba(255,230,180,0.09) 0%, transparent 70%)',
  },

  'sunset-sunny': {
    tint: 'linear-gradient(180deg, rgba(255,145,100,0.22) 0%, rgba(255,170,130,0.14) 35%, rgba(180,135,195,0.10) 75%, rgba(140,110,180,0.06) 100%)',
    sun: 'radial-gradient(ellipse 65% 50% at 16% 40%, rgba(255,150,95,0.40) 0%, rgba(255,120,85,0.14) 38%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 50% 38% at 18% 80%, rgba(255,155,110,0.16) 0%, transparent 70%)',
  },

  'night-sunny': {
    tint: 'linear-gradient(180deg, rgba(52,52,92,0.48) 0%, rgba(58,55,95,0.28) 45%, rgba(60,55,90,0.10) 100%)',
    vignette: 'radial-gradient(ellipse at center, transparent 40%, rgba(28,22,55,0.24) 100%)',
    lamps: [
      { left: '21%', top: '60%', size: '140px', color: 'rgba(255,215,150,0.24)', alpha: 1 },
      { left: '16%', top: '82%', size: '115px', color: 'rgba(255,195,125,0.16)', alpha: 1 },
      { left: '52%', top: '88%', size: '160px', color: 'rgba(255,205,155,0.14)', alpha: 1 },
    ],
  },

  /* ========== 雨天 ========== */

  'sunrise-rainy': {
    tint: 'linear-gradient(180deg, rgba(175,175,195,0.20) 0%, rgba(165,175,195,0.12) 45%, rgba(155,170,190,0.06) 100%)',
    // 雨天没有阳光，用漫射冷灰调代替
    sun: 'radial-gradient(ellipse 55% 45% at 14% 28%, rgba(185,195,215,0.14) 0%, rgba(175,190,210,0.06) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 45% 35% at 18% 82%, rgba(165,180,200,0.08) 0%, transparent 70%)',
  },

  'morning-rainy': {
    tint: 'linear-gradient(180deg, rgba(160,175,195,0.18) 0%, rgba(155,170,190,0.10) 45%, rgba(150,165,185,0.05) 100%)',
    sun: 'radial-gradient(ellipse 55% 45% at 14% 22%, rgba(180,195,215,0.14) 0%, rgba(170,190,210,0.06) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 40% 30% at 14% 78%, rgba(160,180,200,0.07) 0%, transparent 70%)',
  },

  'noon-rainy': {
    tint: 'linear-gradient(180deg, rgba(155,170,190,0.16) 0%, rgba(150,165,185,0.08) 45%, rgba(145,160,180,0.04) 100%)',
    sun: 'radial-gradient(ellipse 52% 40% at 14% 18%, rgba(180,195,215,0.12) 0%, rgba(170,190,210,0.05) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 38% 28% at 14% 74%, rgba(155,175,195,0.06) 0%, transparent 70%)',
  },

  'afternoon-rainy': {
    tint: 'linear-gradient(180deg, rgba(160,175,195,0.18) 0%, rgba(155,170,190,0.10) 45%, rgba(150,165,185,0.05) 100%)',
    sun: 'radial-gradient(ellipse 52% 40% at 14% 24%, rgba(180,195,215,0.13) 0%, rgba(170,190,210,0.055) 40%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 40% 30% at 14% 76%, rgba(160,180,200,0.065) 0%, transparent 70%)',
  },

  'sunset-rainy': {
    tint: 'linear-gradient(180deg, rgba(170,140,160,0.18) 0%, rgba(165,145,165,0.12) 35%, rgba(135,120,160,0.10) 75%, rgba(110,100,150,0.06) 100%)',
    sun: 'radial-gradient(ellipse 60% 48% at 16% 40%, rgba(190,155,170,0.18) 0%, rgba(165,140,165,0.08) 38%, transparent 65%)',
    floorGlow: 'radial-gradient(ellipse 48% 36% at 18% 80%, rgba(185,155,170,0.10) 0%, transparent 70%)',
  },

  'night-rainy': {
    tint: 'linear-gradient(180deg, rgba(48,52,82,0.50) 0%, rgba(52,52,85,0.30) 45%, rgba(55,52,80,0.12) 100%)',
    vignette: 'radial-gradient(ellipse at center, transparent 42%, rgba(25,20,50,0.26) 100%)',
    // 雨夜灯光更冷、更弱一点
    lamps: [
      { left: '21%', top: '60%', size: '130px', color: 'rgba(245,210,170,0.20)', alpha: 1 },
      { left: '16%', top: '82%', size: '110px', color: 'rgba(245,190,145,0.13)', alpha: 1 },
      { left: '52%', top: '88%', size: '150px', color: 'rgba(245,200,145,0.12)', alpha: 1 },
    ],
  },
};

const LightingOverlay = ({ weather, timePhase }: LightingOverlayProps) => {
  const key: PhaseKey = `${timePhase}-${weather}`;
  const style = STYLES[key];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        className="absolute inset-0 pointer-events-none z-[4] overflow-hidden"
        style={{ borderRadius: '20px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      >
        {/* 整体色温渐变 */}
        <div className="absolute inset-0" style={{ background: style.tint }} />

        {/* 太阳光 / 雨天漫射光 */}
        {style.sun && (
          <div className="absolute inset-0" style={{ background: style.sun }} />
        )}

        {/* 地板反光 */}
        {style.floorGlow && (
          <div className="absolute inset-0" style={{ background: style.floorGlow }} />
        )}

        {/* 夜晚灯光 */}
        {style.lamps?.map((l, i) => (
          <div
            key={`lamp-${i}`}
            className="absolute"
            style={{
              left: l.left,
              top: l.top,
              width: l.size,
              height: l.size,
              background: `radial-gradient(circle, ${l.color} 0%, transparent 68%)`,
              transform: 'translate(-50%, -50%)',
              opacity: l.alpha,
            }}
          />
        ))}

        {/* 暗角 */}
        {style.vignette && (
          <div className="absolute inset-0" style={{ background: style.vignette }} />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default LightingOverlay;
