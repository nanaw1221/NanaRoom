import { motion } from 'framer-motion';

interface HotspotProps {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isHovered: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
}

/**
 * 画布基准尺寸 = 用户图片的真实分辨率：1501 × 1048
 * 所有坐标、宽高都按这张图上量出来的像素填。
 *
 * 调试模式（方便你校准）：
 *   下面 SHOW_DEBUG_BOX 设为 true 时，每个热点区会显示彩色虚线框，
 *   框里还会有一个小标签写热点名字。
 *   你看一眼框是否正好套在图上对应的物件上，就知道坐标偏多少了。
 *   校准完后把 SHOW_DEBUG_BOX 改回 false 即可。
 */
const CANVAS_W = 1501;
const CANVAS_H = 1048;

const SHOW_DEBUG_BOX = true;    // 临时打开：让用户看到所有热点精确位置和名字，点对就出数据

const DEBUG_COLORS: Record<string, string> = {
  bookshelf: '#ff4d8a',
  projector: '#ff7a2e',
  notebook:  '#3bbf4a',
  albums:    '#4a8bff',
  travel:    '#b974ff',
  concerts:  '#f2c037',
};

const Hotspot = ({
  id,
  label,
  x,
  y,
  width,
  height,
  isHovered,
  onClick,
  onHover,
}: HotspotProps) => {
  const debugColor = DEBUG_COLORS[id] ?? '#ff0000';

  return (
    <motion.div
      className="absolute z-30 cursor-pointer"
      style={{
        left: `${(x / CANVAS_W) * 100}%`,
        top: `${(y / CANVAS_H) * 100}%`,
        width: `${(width / CANVAS_W) * 100}%`,
        height: `${(height / CANVAS_H) * 100}%`,
        cursor: isHovered ? 'pointer' : 'default',

        /* ============== 调试框：校准完后下面整段可以删掉 ============== */
        outline: SHOW_DEBUG_BOX ? `2px dashed ${debugColor}` : undefined,
        outlineOffset: SHOW_DEBUG_BOX ? '-1px' : undefined,
        background: SHOW_DEBUG_BOX && isHovered ? `${debugColor}22` : undefined,
        /* ============================================================ */
      }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      whileHover={{ scale: 1.0 }}
      whileTap={{ scale: 0.98 }}
    >
      {SHOW_DEBUG_BOX && (
        <span
          style={{
            position: 'absolute',
            left: 4,
            top: -2,
            transform: 'translateY(-100%)',
            padding: '2px 6px',
            borderRadius: 6,
            background: debugColor,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {label} · {Math.round(x)},{Math.round(y)} {Math.round(width)}×{Math.round(height)}
        </span>
      )}
    </motion.div>
  );
};

export default Hotspot;
