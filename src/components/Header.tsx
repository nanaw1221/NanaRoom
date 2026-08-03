/*
  NanaRoom 手绘标题组件 v10（布局从"顶部居中"→"左侧固定栏"）
  ===========================================
  新增左右双栏布局参数（也在校准面板可调）：
    sidebarW         左侧标题栏宽度（默认 200px）
    sidebarAlignX    标题在左栏中的横向对齐（0=左 1=中 2=右）
    sidebarAlignY    标题在左栏中的纵向对齐（0=上 1=中 2=下）
  其它：和 v9 相同
*/

import { useState, useEffect, useRef } from 'react';
import AdminLoginModal from './AdminLoginModal';

// localStorage key（App.tsx 也会读它来确定左栏宽度，保持同步）
export const HEADER_CALIB_KEY = 'na-header-calib-v1';

// ========== 最终参数（用户于 2026/8/2 20:13 通过校准面板调整完毕） ==========
export const HEADER_DEFAULTS = {
  // ---- 标题本身 ----
  sizePx: 198,          // 标题宽度（桌面端 max-width）
  sizeMinPx: 76,        // 移动端 min-width
  offsetYPx: -80,       // 纵向总位移（+下 -上）
  overlapBottomPx: 22,  // 底部重叠量（和下方房间图）
  clipInsetPct: 4,      // 四边裁%（去外框线）
  bgBlend: 1,           // 背景融合强度 0~1（1=和页面完全一色）
  bgBrightness: 1.12,   // 正片叠底后整体提亮
  // ---- 左右双栏布局参数 ----
  sidebarW: 236,        // ★ 左侧标题栏宽度（像素）
  sidebarAlignX: 2,     // ★ 横向对齐（0=左 1=中 2=右）
  sidebarAlignY: 1,     // ★ 纵向对齐（0=上 1=中 2=下）
  offsetXPx: 80,        // ★ 横向额外微调（+右 -左）
  // ---- 右侧房间（RoomScene）对齐 / 位置 / 贴紧控制 ----
  roomAlignX: 0,        // ★ 房间横向对齐（0=贴左靠近标题 1=居中 2=贴右）
  roomMaxW: 1040,       // ★ 房间最大宽度（像素）
  roomOffsetXPx: -58,   // ★ 房间横向额外微调（+右 -左）
  roomContentGapXPx: 66,// ★ 房间与左侧标题栏之间的间隙 px（负值=重叠上）
};

export type HeaderCalibParams = typeof HEADER_DEFAULTS;

// --- 便捷：给 App.tsx 直接用的读取函数（无需再抄 localStorage key） ---
export function readHeaderCalib(): HeaderCalibParams {
  try {
    const saved = localStorage.getItem(HEADER_CALIB_KEY);
    if (saved) return { ...HEADER_DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return HEADER_DEFAULTS;
}

const Header = () => {
  // ========== 0. 移动端检测（和 App.tsx 保持一致：<640px 为移动端） ==========
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // 2. 识别校准模式：URL ?headerCalib=1
  const [showCalib] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('headerCalib') === '1';
    } catch {
      return false;
    }
  });

  // ========== 🛡 管理员登录入口（隐藏）：标题连点 5 次触发 ==========
  const [showLogin, setShowLogin] = useState(false);
  const clickTimesRef = useRef<number[]>([]);
  const onTitleClick = () => {
    const now = Date.now();
    // 3 秒内的连续点击才计数，否则重置
    clickTimesRef.current = clickTimesRef.current.filter((t) => now - t < 3000);
    clickTimesRef.current.push(now);
    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = [];
      setShowLogin(true);
    }
  };

  // 1. 初始化参数（只有校准模式才读 localStorage）
  const [params, setParams] = useState<HeaderCalibParams>(() => {
    if (showCalib) {
      try {
        const saved = localStorage.getItem(HEADER_CALIB_KEY);
        if (saved) return { ...HEADER_DEFAULTS, ...JSON.parse(saved) };
      } catch {}
    }
    return HEADER_DEFAULTS;
  });

  // 3. 参数变更时存进 localStorage（仅校准模式）
  useEffect(() => {
    if (showCalib) {
      localStorage.setItem(HEADER_CALIB_KEY, JSON.stringify(params));
      // 触发 storage 事件，让 App.tsx 实时收到侧边栏宽度变化
      window.dispatchEvent(new Event('header-calib-updated'));
    }
  }, [params, showCalib]);

  // 4. 一键复制导出参数
  const handleExport = () => {
    const code =
`// Header.tsx 最终参数（调于 ${new Date().toLocaleString()}）
const DEFAULTS = {
  sizePx: ${params.sizePx},          // 标题宽度（桌面端 max-width）
  sizeMinPx: ${params.sizeMinPx},        // 移动端 min-width
  offsetYPx: ${params.offsetYPx},        // 纵向总位移（+下 -上）
  overlapBottomPx: ${params.overlapBottomPx},   // 底部重叠量（和房间图）
  clipInsetPct: ${params.clipInsetPct},      // 四边裁%（去外框）
  bgBlend: ${Number(params.bgBlend.toFixed(2))},       // 背景融合强度 0~1（1=和页面一色）
  bgBrightness: ${Number(params.bgBrightness.toFixed(2))},   // 正片叠底后提亮
  sidebarW: ${params.sidebarW},        // 左侧标题栏宽度（像素）
  sidebarAlignX: ${params.sidebarAlignX},     // 横向对齐（0=左 1=中 2=右）
  sidebarAlignY: ${params.sidebarAlignY},     // 纵向对齐（0=上 1=中 2=下）
  offsetXPx: ${params.offsetXPx},         // 横向额外微调（+右 -左）
  roomAlignX: ${params.roomAlignX},        // 房间横向对齐（0=贴左近标题 1=居中 2=贴右）
  roomMaxW: ${params.roomMaxW},       // 房间最大宽度（像素）
  roomOffsetXPx: ${params.roomOffsetXPx},     // 房间横向额外微调（+右 -左）
  roomContentGapXPx: ${params.roomContentGapXPx}, // 房间与标题间隙（负值=重叠）
};`;
    try {
      navigator.clipboard.writeText(code).then(() => {
        alert('✅ 参数已复制到剪贴板！粘贴发给我就可以了');
      }).catch(() => {
        prompt('请手动复制下方代码发给我：', code);
      });
    } catch {
      prompt('请手动复制下方代码发给我：', code);
    }
  };

  // 5. 重置
  const handleReset = () => {
    if (confirm('确定恢复为默认参数？')) {
      localStorage.removeItem(HEADER_CALIB_KEY);
      setParams(HEADER_DEFAULTS);
    }
  };

  // 便捷：单个参数的 setter
  const setParam = (k: keyof HeaderCalibParams, v: number) =>
    setParams(prev => ({ ...prev, [k]: v }));

  // --- 布局计算：横向 / 纵向对齐（0=左/上  1=中  2=右/下）---
  const justifyMap = ['flex-start', 'center', 'flex-end'] as const;
  const alignMap = ['flex-start', 'center', 'flex-end'] as const;

  // ========== 移动端 / 桌面端 独立布局参数 ==========
  // 移动端：顶部居中标题，不要用桌面端左侧栏的 offsetYPx=-80 等参数，否则标题会跑出屏幕
  const layout = {
    justify: isMobile ? 'center' : justifyMap[params.sidebarAlignX],
    align: isMobile ? 'flex-start' : alignMap[params.sidebarAlignY],
    offsetYPx: isMobile ? 12 : params.offsetYPx,     // 移动端：顶部往下 12px 露出，桌面端：原校准值
    offsetXPx: isMobile ? 0  : params.offsetXPx,      // 移动端：水平归零，桌面端：原校准值
    titleSizeMaxPx: isMobile ? 150 : params.sizePx,   // 移动端：标题最大 150px，桌面端：原校准大小
    titleSizeMinPx: isMobile ? 90  : params.sizeMinPx,// 移动端：最小 90px，桌面端：原校准最小值
  };

  return (
    <>
      {/* ================== 标题本身 ================== */}
      {/*
        v10 改动：
          - 外层 <header> 变成"占满左栏宽高"的 flex 容器（不再是横向满屏块）
          - 内部按 sidebarAlignX/Y 决定标题在左栏中的位置
          - offsetXPx/offsetYPx 作为"对齐后的额外微调位移"
          - 横条色块始终没有！因为透明 header 透出页面 body 的米黄渐变
        v11 移动端适配：
          - 窄屏(<640px)时：强制居中对齐、顶部露出，标题缩小，避免标题被顶栏挡住
      */}
      <header
        className="w-full h-full flex select-none"
        onClick={onTitleClick}
        title=""
        style={{
          justifyContent: layout.justify,
          alignItems: layout.align,
          cursor: 'default',
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
        }}
      >
        <div
          style={{
            marginTop: `${layout.offsetYPx}px`,
            marginLeft: `${layout.offsetXPx}px`,
            marginBottom: isMobile ? '6px' : `${-params.overlapBottomPx}px`,
          }}
        >
          <div
            className="relative inline-flex items-center justify-center"
            style={{
              width: `clamp(${layout.titleSizeMinPx}px, 24vw, ${layout.titleSizeMaxPx}px)`,
              maxWidth: `${layout.titleSizeMaxPx}px`,
            }}
          >
            {/* 图片：正片叠底融合 + 提亮 */}
            <img
              src="/title-nanaroom.png"
              alt="NanaRoom"
              draggable={false}
              className="block w-full h-auto"
              style={{
                clipPath: `inset(${params.clipInsetPct}% ${params.clipInsetPct}% ${params.clipInsetPct}% ${params.clipInsetPct}%)`,
                objectFit: 'contain',
                filter: `drop-shadow(2px 2px 0 rgba(74,62,53,0.14)) brightness(${params.bgBrightness})`,
                mixBlendMode: 'multiply',
                opacity: params.bgBlend,
              }}
            />
          </div>
        </div>
      </header>

      {/* ================== 校准模式控制面板 ================== */}
      {showCalib && (
        <div
          className="fixed z-[100] top-3 right-3 bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-3 border border-[#e8dfd0] text-[#5d4e37] font-sans text-xs w-[260px] max-h-[95vh] overflow-y-auto"
          style={{ fontFamily: "'Nunito','PingFang SC','Microsoft YaHei',sans-serif" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-sm" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              🎛 标题校准面板
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(HEADER_CALIB_KEY);
                setParams(HEADER_DEFAULTS);
                const url = new URL(window.location.href);
                url.searchParams.delete('headerCalib');
                window.location.href = url.toString();
              }}
              className="text-[10px] text-gray-500 hover:text-red-500"
            >
              ✕
            </button>
          </div>

          {/* --- 新增：左右双栏布局相关（v10 本次重点） --- */}
          <div className="mb-2.5 p-2 rounded-lg bg-[#eaf0ff] border border-[#c7d6f2]">
            <div className="font-bold text-[11px] mb-2" style={{ color: '#3a5690' }}>
              📐 左侧标题栏布局（新）
            </div>

            {/* 新滑块：侧栏宽度 */}
            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>左栏宽度 sidebarW</label>
                <span className="font-bold">{params.sidebarW}px</span>
              </div>
              <input
                type="range" min="100" max="400" step="2"
                value={params.sidebarW}
                onChange={e => setParam('sidebarW', Number(e.target.value))}
                className="w-full accent-[#3a5690]"
              />
            </div>

            {/* 横向对齐 */}
            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>横向对齐 X</label>
                <span className="font-bold">
                  {['左对齐', '居中', '右对齐'][params.sidebarAlignX]}
                </span>
              </div>
              <input
                type="range" min="0" max="2" step="1"
                value={params.sidebarAlignX}
                onChange={e => setParam('sidebarAlignX', Number(e.target.value))}
                className="w-full accent-[#3a5690]"
              />
            </div>

            {/* 纵向对齐 */}
            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>纵向对齐 Y</label>
                <span className="font-bold">
                  {['顶部', '中部', '底部'][params.sidebarAlignY]}
                </span>
              </div>
              <input
                type="range" min="0" max="2" step="1"
                value={params.sidebarAlignY}
                onChange={e => setParam('sidebarAlignY', Number(e.target.value))}
                className="w-full accent-[#3a5690]"
              />
            </div>

            {/* 横向微调 */}
            <div>
              <div className="flex justify-between mb-0.5">
                <label>横向额外微调 offsetX</label>
                <span className="font-bold">
                  {params.offsetXPx >= 0 ? '+' : ''}{params.offsetXPx}px
                </span>
              </div>
              <input
                type="range" min="-80" max="160" step="1"
                value={params.offsetXPx}
                onChange={e => setParam('offsetXPx', Number(e.target.value))}
                className="w-full accent-[#3a5690]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">← 负值=往左推，正值=往右拉</div>
            </div>
          </div>

          {/* --- 新增：右侧房间（RoomScene）贴紧控制 --- */}
          <div className="mb-2.5 p-2 rounded-lg bg-[#f1fff2] border border-[#c4e6c8]">
            <div className="font-bold text-[11px] mb-2" style={{ color: '#2f7a42' }}>
              🏠 右侧房间（贴近标题）
            </div>

            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>房间横向对齐 roomAlignX</label>
                <span className="font-bold">
                  {['贴左(近标题)', '居中', '贴右'][params.roomAlignX]}
                </span>
              </div>
              <input
                type="range" min="0" max="2" step="1"
                value={params.roomAlignX}
                onChange={e => setParam('roomAlignX', Number(e.target.value))}
                className="w-full accent-[#2f7a42]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">选"贴左"就能紧紧挨着标题栏</div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>房间最大宽度 roomMaxW</label>
                <span className="font-bold">{params.roomMaxW}px</span>
              </div>
              <input
                type="range" min="700" max="1600" step="10"
                value={params.roomMaxW}
                onChange={e => setParam('roomMaxW', Number(e.target.value))}
                className="w-full accent-[#2f7a42]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">越大房间越大（原始背景图 1501）</div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>与标题的间隙 gap</label>
                <span className="font-bold">
                  {params.roomContentGapXPx >= 0 ? '+' : ''}
                  {params.roomContentGapXPx}px
                </span>
              </div>
              <input
                type="range" min="-120" max="120" step="1"
                value={params.roomContentGapXPx}
                onChange={e => setParam('roomContentGapXPx', Number(e.target.value))}
                className="w-full accent-[#2f7a42]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">负值=重叠到标题上，0=紧贴</div>
            </div>

            <div>
              <div className="flex justify-between mb-0.5">
                <label>房间整体微调 roomOffsetX</label>
                <span className="font-bold">
                  {params.roomOffsetXPx >= 0 ? '+' : ''}{params.roomOffsetXPx}px
                </span>
              </div>
              <input
                type="range" min="-160" max="240" step="1"
                value={params.roomOffsetXPx}
                onChange={e => setParam('roomOffsetXPx', Number(e.target.value))}
                className="w-full accent-[#2f7a42]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">← 左推 ， 右拉 →</div>
            </div>
          </div>

          {/* --- 背景融合相关 --- */}
          <div className="mb-2.5 p-2 rounded-lg bg-[#fff8ea] border border-[#e8dfd0]">
            <div className="font-bold text-[11px] mb-2" style={{ color: '#8b6a48' }}>
              🎨 背景颜色融合（本次新增）
            </div>

            {/* 新滑块：背景融合强度 */}
            <div className="mb-2">
              <div className="flex justify-between mb-0.5">
                <label>融合强度（白底→页面色）</label>
                <span className="font-bold">{(params.bgBlend * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min="0.3" max="1" step="0.02"
                value={params.bgBlend}
                onChange={e => setParam('bgBlend', Number(e.target.value))}
                className="w-full accent-[#8b6a48]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">越大=标题白底越接近米黄渐变背景</div>
            </div>

            {/* 新滑块：提亮 */}
            <div>
              <div className="flex justify-between mb-0.5">
                <label>整体亮度</label>
                <span className="font-bold">{params.bgBrightness.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.8" max="1.3" step="0.01"
                value={params.bgBrightness}
                onChange={e => setParam('bgBrightness', Number(e.target.value))}
                className="w-full accent-[#8b6a48]"
              />
              <div className="text-[9px] text-gray-400 mt-0.5">融合后若整体偏暗，往右提高亮度</div>
            </div>
          </div>

          {/* 滑块 1：标题大小 */}
          <div className="mb-2.5">
            <div className="flex justify-between mb-0.5">
              <label>📐 标题大小（桌面端 max-width）</label>
              <span className="font-bold">{params.sizePx}px</span>
            </div>
            <input
              type="range" min="60" max="340" step="2"
              value={params.sizePx}
              onChange={e => setParam('sizePx', Number(e.target.value))}
              className="w-full accent-[#8b6a48]"
            />
          </div>

          {/* 滑块 2：移动端最小 */}
          <div className="mb-2.5">
            <div className="flex justify-between mb-0.5">
              <label>📱 移动端最小宽度</label>
              <span className="font-bold">{params.sizeMinPx}px</span>
            </div>
            <input
              type="range" min="50" max="160" step="2"
              value={params.sizeMinPx}
              onChange={e => setParam('sizeMinPx', Number(e.target.value))}
              className="w-full accent-[#8b6a48]"
            />
          </div>

          {/* 滑块 3：纵向总位移 */}
          <div className="mb-2.5">
            <div className="flex justify-between mb-0.5">
              <label>⬇⬆ 整体上下位移</label>
              <span className="font-bold">{params.offsetYPx >= 0 ? '+' : ''}{params.offsetYPx}px</span>
            </div>
            <input
              type="range" min="-80" max="300" step="1"
              value={params.offsetYPx}
              onChange={e => setParam('offsetYPx', Number(e.target.value))}
              className="w-full accent-[#8b6a48]"
            />
            <div className="text-[9px] text-gray-400 mt-0.5">← 负值=往上飘 ， 正值=往下沉</div>
          </div>

          {/* 滑块 4：底部重叠 */}
          <div className="mb-2.5">
            <div className="flex justify-between mb-0.5">
              <label>📎 底部下沉/重叠</label>
              <span className="font-bold">{params.overlapBottomPx}px</span>
            </div>
            <input
              type="range" min="0" max="120" step="1"
              value={params.overlapBottomPx}
              onChange={e => setParam('overlapBottomPx', Number(e.target.value))}
              className="w-full accent-[#8b6a48]"
            />
            <div className="text-[9px] text-gray-400 mt-0.5">越大=标题和房间图重叠越多</div>
          </div>

          {/* 滑块 5：外框裁剪 */}
          <div className="mb-3">
            <div className="flex justify-between mb-0.5">
              <label>✂ 外框裁剪量（四边各裁）</label>
              <span className="font-bold">{params.clipInsetPct}%</span>
            </div>
            <input
              type="range" min="0" max="10" step="0.5"
              value={params.clipInsetPct}
              onChange={e => setParam('clipInsetPct', Number(e.target.value))}
              className="w-full accent-[#8b6a48]"
            />
            <div className="text-[9px] text-gray-400 mt-0.5">0%=不裁（留外框线）</div>
          </div>

          {/* 按钮 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-1.5 rounded-lg border border-[#d6cbb8] text-[11px] hover:bg-[#f5efe6]"
            >
              🔄 还原默认
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 py-1.5 rounded-lg bg-[#8b6a48] text-white text-[11px] font-bold hover:bg-[#6a5238] shadow"
            >
              📋 导出参数
            </button>
          </div>

          <div className="text-[9px] text-gray-400 mt-2 leading-snug">
            💡 调整结果自动存到浏览器 localStorage<br />
            调完点「导出参数」，把复制的代码发给我即可
          </div>
        </div>
      )}

      {/* 管理员登录弹窗（隐藏入口：标题连点 5 次打开） */}
      <AdminLoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
};

export default Header;
