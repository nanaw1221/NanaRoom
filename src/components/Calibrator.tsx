import { useState, useRef, useEffect, useCallback } from 'react';
import RoomSVG from './RoomSVG';
import WindowSky from './WindowSky';
import ClockHands from './ClockHands';
import { useWindowState } from '../hooks/useWindowState';

// 画布基准尺寸：背景图真实分辨率
const CANVAS_W = 1501;
const CANVAS_H = 1048;

// 初始待校准元素（当前代码中的值，拖拽后会更新）
type CalItem = {
  id: string;
  label: string;
  color: string;
  shape: 'rect' | 'cross';  // rect = 热点框，cross = 时钟准星
  x: number; y: number;     // 画布坐标（1501×1048）
  w?: number; h?: number;   // 矩形的宽高
};

const INITIAL_ITEMS: CalItem[] = [
  { id: 'clock',    label: '时钟',  color: '#ff4444', shape: 'cross', x: 1254, y: 98  },
  { id: 'projector',label: '投影仪',color: '#ff8800', shape: 'rect',  x: 662,  y: 6,   w: 191, h: 118 },
  { id: 'bookshelf',label: '书架',  color: '#00cc66', shape: 'rect',  x: 1041, y: 683, w: 381, h: 345 },
  { id: 'albums',   label: '专辑柜',color: '#0088ff', shape: 'rect',  x: 1041, y: 431, w: 381, h: 259 },
  { id: 'notebook', label: '笔记本',color: '#cc66ff', shape: 'rect',  x: 374,  y: 540, w: 132, h: 79  },
  { id: 'travel',   label: '明信片',color: '#ffcc00', shape: 'rect',  x: 1253, y: 227, w: 95,  h: 65  },
  { id: 'concerts', label: '机票',  color: '#ff66cc', shape: 'rect',  x: 1092, y: 247, w: 129, h: 58  },
  // 窗户四格（独立管理）
];

const INITIAL_WINDOW_PANES = [
  { id: 'pane1', label: 'pane 1', x: 41, y: 40, w: 176, h: 276, color: '#ff00ff' },
  { id: 'pane2', label: 'pane 2', x: 238, y: 40, w: 176, h: 276, color: '#ff00ff' },
  { id: 'pane3', label: 'pane 3', x: 41, y: 337, w: 176, h: 267, color: '#ff00ff' },
  { id: 'pane4', label: 'pane 4', x: 238, y: 337, w: 176, h: 267, color: '#ff00ff' },
];

type WindowPane = typeof INITIAL_WINDOW_PANES[number];

/**
 * 交互式校准组件
 * - 显示背景图、窗口天空、时钟指针
 * - 每个元素都可以拖拽定位
 * - 实时显示画布坐标
 * - 点击"复制导出"生成最终代码
 */
const Calibrator = () => {
  const [items, setItems] = useState<CalItem[]>(INITIAL_ITEMS);
  const [panes, setPanes] = useState<WindowPane[]>(INITIAL_WINDOW_PANES);
  const [exported, setExported] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // 监听容器实际尺寸（背景图渲染后的真实尺寸）
  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    const observer = new ResizeObserver(updateRect);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
    };
  }, []);

  // 画布坐标 → DOM 百分比
  const canvasToPct = useCallback((cx: number, cy: number) => {
    return {
      left: (cx / CANVAS_W) * 100,
      top:  (cy / CANVAS_H) * 100,
    };
  }, []);

  // 拖拽处理
  const [dragging, setDragging] = useState<{
    itemId: string;
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    startW: number;
    startH: number;
    mode: 'move' | 'resize';
  } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, itemId: string, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    const target = items.find(i => i.id === itemId) || panes.find(p => p.id === itemId);
    if (!target || !containerRect) return;

    // 区分是 items 还是 panes
    const isPane = 'color' in target && itemId.startsWith('pane');
    const t = target as any;

    setDragging({
      itemId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCanvasX: t.x,
      startCanvasY: t.y,
      startW: t.w ?? 0,
      startH: t.h ?? 0,
      mode,
      // @ts-ignore
      _isPane: isPane,
    } as any);
  }, [items, panes, containerRect]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      if (!containerRect) return;
      const dxClient = e.clientX - dragging.startClientX;
      const dyClient = e.clientY - dragging.startClientY;

      // 将 DOM 像素偏移转换为画布坐标偏移
      const scaleX = CANVAS_W / containerRect.width;
      const scaleY = CANVAS_H / containerRect.height;
      const dCanvasX = Math.round(dxClient * scaleX);
      const dCanvasY = Math.round(dyClient * scaleY);

      const isPane = (dragging as any)._isPane;

      if (dragging.mode === 'move') {
        if (isPane) {
          setPanes(prev => prev.map(p =>
            p.id === dragging.itemId
              ? { ...p, x: dragging.startCanvasX + dCanvasX, y: dragging.startCanvasY + dCanvasY }
              : p
          ));
        } else {
          setItems(prev => prev.map(it =>
            it.id === dragging.itemId
              ? { ...it, x: dragging.startCanvasX + dCanvasX, y: dragging.startCanvasY + dCanvasY }
              : it
          ));
        }
      } else {
        // resize 模式：只改 w/h
        if (isPane) {
          setPanes(prev => prev.map(p =>
            p.id === dragging.itemId
              ? { ...p, w: Math.max(5, dragging.startW + dCanvasX), h: Math.max(5, dragging.startH + dCanvasY) }
              : p
          ));
        } else {
          setItems(prev => prev.map(it =>
            it.id === dragging.itemId
              ? { ...it, w: Math.max(5, dragging.startW + dCanvasX), h: Math.max(5, dragging.startH + dCanvasY) }
              : it
          ));
        }
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, containerRect]);

  // 导出坐标为代码
  const handleExport = () => {
    const hotspotLines = items
      .filter(i => i.shape === 'rect')
      .map(i => {
        const catMap: Record<string, string> = {
          projector: 'movies',
          bookshelf: 'books',
          albums: 'albums',
          notebook: 'notes',
          travel: 'travel',
          concerts: 'concerts',
        };
        const cat = catMap[i.id] || i.id;
        return `    { id: '${i.id}', label: '${i.label}', category: '${cat}', x: ${i.x}, y: ${i.y}, width: ${i.w}, height: ${i.h} },`;
      })
      .join('\n');

    const clockItem = items.find(i => i.id === 'clock');
    const clockLines = clockItem
      ? `const CLOCK_CX = ${clockItem.x};\nconst CLOCK_CY = ${clockItem.y};\nconst CLOCK_R = 66;`
      : '';

    const windowLines = panes
      .map((p) => `  { x: ${p.x}, y: ${p.y}, w: ${p.w}, h: ${p.h} }, // ${p.label}`)
      .join('\n');

    const winX = Math.min(...panes.map(p => p.x));
    const winY = Math.min(...panes.map(p => p.y));
    const winRight = Math.max(...panes.map(p => p.x + p.w));
    const winBottom = Math.max(...panes.map(p => p.y + p.h));
    const winW = winRight - winX;
    const winH = winBottom - winY;

    const winLine = `const WIN_X = ${winX};\nconst WIN_Y = ${winY};\nconst WIN_W = ${winW};\nconst WIN_H = ${winH};`;

    const output = `// ====== 校准结果（从交互式校准工具导出） ======
// 使用方法：把对应的值复制替换到 ClockHands.tsx / WindowSky.tsx / RoomScene.tsx 中

// ClockHands.tsx:
${clockLines}

// WindowSky.tsx:
const PANES = [
${windowLines}
];
${winLine}

// RoomScene.tsx:
const hotspotDefs: HotspotDef[] = [
${hotspotLines}
];`;

    setExported(output);
    console.log('校准结果：\n' + output);
  };

  // 重置
  const handleReset = () => {
    setItems(INITIAL_ITEMS);
    setPanes(INITIAL_WINDOW_PANES);
    setExported(null);
  };

  const { now } = useWindowState();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-rose-50 to-sky-50 p-4">
      {/* 顶部工具栏 */}
      <div className="max-w-[1200px] mx-auto mb-4 flex items-center gap-3 bg-white/80 backdrop-blur p-3 rounded-xl shadow-lg">
        <span className="text-sm font-bold text-rose-600">🎯 交互式校准模式</span>
        <span className="text-xs text-gray-600">拖动蓝色/彩色框到正确位置，拖右下角绿色方块调整大小，完成后点「导出坐标」</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            重置
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-1.5 text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-md font-bold transition"
          >
            导出坐标 ↓
          </button>
        </div>
      </div>

      {/* 画布 */}
      <div className="max-w-[1200px] mx-auto">
        <div
          ref={containerRef}
          className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        >
          {/* 背景图 */}
          <RoomSVG />
          {/* 窗户天空层 */}
          <WindowSky timePhase="noon" weather="sunny" />
          {/* 时钟指针 */}
          <ClockHands now={now} weather="sunny" timePhase="noon" />

          {/* 四块玻璃校准框（粉色） */}
          {panes.map(p => {
            const pos = canvasToPct(p.x, p.y);
            const wPct = (p.w / CANVAS_W) * 100;
            const hPct = (p.h / CANVAS_H) * 100;
            return (
              <div
                key={p.id}
                className="absolute border-2 border-dashed cursor-move z-30"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  width: `${wPct}%`,
                  height: `${hPct}%`,
                  borderColor: p.color,
                  background: `${p.color}15`,
                }}
                onPointerDown={(e) => handlePointerDown(e, p.id, 'move')}
              >
                {/* 尺寸调节手柄 */}
                <div
                  className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-green-500 rounded-sm cursor-nwse-resize hover:bg-green-600"
                  onPointerDown={(e) => handlePointerDown(e, p.id, 'resize')}
                />
                {/* 坐标标签 */}
                <div className="absolute -top-5 left-0 text-[10px] bg-pink-500 text-white px-1 rounded whitespace-nowrap font-mono">
                  {p.label} ({p.x},{p.y}) {p.w}×{p.h}
                </div>
              </div>
            );
          })}

          {/* 热点矩形框（彩色） */}
          {items.filter(i => i.shape === 'rect').map(item => {
            const pos = canvasToPct(item.x, item.y);
            const wPct = ((item.w || 0) / CANVAS_W) * 100;
            const hPct = ((item.h || 0) / CANVAS_H) * 100;
            return (
              <div
                key={item.id}
                className="absolute border-2 border-dashed cursor-move z-30"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  width: `${wPct}%`,
                  height: `${hPct}%`,
                  borderColor: item.color,
                  background: `${item.color}20`,
                }}
                onPointerDown={(e) => handlePointerDown(e, item.id, 'move')}
              >
                <div
                  className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-green-500 rounded-sm cursor-nwse-resize hover:bg-green-600"
                  onPointerDown={(e) => handlePointerDown(e, item.id, 'resize')}
                />
                <div className="absolute -top-5 left-0 text-[10px] px-1 rounded whitespace-nowrap font-mono text-white"
                     style={{ backgroundColor: item.color }}>
                  {item.label} · {item.x},{item.y} {item.w}×{item.h}
                </div>
              </div>
            );
          })}

          {/* 时钟准星（十字线） */}
          {items.filter(i => i.shape === 'cross').map(item => {
            const pos = canvasToPct(item.x, item.y);
            const scalePct = (66 / CANVAS_W) * 100; // 显示半径参考
            return (
              <div
                key={item.id}
                className="absolute z-30 cursor-move"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onPointerDown={(e) => handlePointerDown(e, item.id, 'move')}
              >
                {/* 十字线 */}
                <div className="relative w-16 h-16">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500" />
                  {/* 参考圆圈 */}
                  <div
                    className="absolute border-2 border-red-400 rounded-full"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: `${scalePct * 2 * CANVAS_W / CANVAS_W}%`,
                      height: `${scalePct * 2 * CANVAS_H / CANVAS_H}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] bg-red-500 text-white px-1 rounded whitespace-nowrap font-mono">
                  {item.label} ({item.x}, {item.y}) R=66
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 导出结果区 */}
      {exported && (
        <div className="max-w-[1200px] mx-auto mt-4 bg-gray-900 text-green-400 p-4 rounded-xl shadow-xl">
          <div className="text-sm mb-2 font-bold text-white">✅ 已复制到剪贴板，以下是校准结果：</div>
          <pre className="text-xs overflow-auto max-h-60 font-mono whitespace-pre-wrap">{exported}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(exported)}
            className="mt-3 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-bold"
          >
            复制全部
          </button>
        </div>
      )}
    </div>
  );
};

export default Calibrator;
