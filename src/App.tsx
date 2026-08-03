import { useState, useEffect } from 'react';
import Header, { readHeaderCalib } from './components/Header';
import RoomScene from './components/RoomScene';
import ThemedCard from './components/ThemedCard';
import Calibrator from './components/Calibrator';
import { useWindowState } from './hooks/useWindowState';
import { categoryDefs } from './types/records';
import type { RecordCategory } from './types/records';
import { AuthProvider, useAuth } from './hooks/useAuth';

function App() {
  // 调试模式：访问 http://localhost:5173/?calib=1 即可启用交互式校准
  const [showCalibrator, setShowCalibrator] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calib') === '1') {
      setShowCalibrator(true);
    }
  }, []);

  if (showCalibrator) {
    return (
      <>
        <Calibrator />
        <div className="fixed bottom-3 right-3 z-50">
          <button
            onClick={() => setShowCalibrator(false)}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-bold hover:bg-gray-800 shadow-lg"
          >
            退出校准
          </button>
        </div>
      </>
    );
  }

  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

function MainApp() {
  const {
    weather,
    timePhase,
    toggleWeather,
    now,
  } = useWindowState();

  const { isAdmin } = useAuth();

  const [activeCategory, setActiveCategory] = useState<RecordCategory | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [headerCalib, setHeaderCalib] = useState(() => readHeaderCalib());
  useEffect(() => {
    const sync = () => setHeaderCalib(readHeaderCalib());
    window.addEventListener('header-calib-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('header-calib-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // 小屏（<640px）：回退为"上标题 + 下内容"的纵向布局，移动端更友好
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleHotspotClick = (category: RecordCategory) => {
    setActiveCategory(category);
    setHoveredId(null);
  };

  const handlePanelClose = () => {
    setActiveCategory(null);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        // 外层：桌面端横向双栏（flex-row），移动端纵向双栏（flex-col）
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'stretch',
        padding: isMobile ? '0 0 32px 0' : '0 16px 0 0',
      }}
    >
      {/* ============ 左侧：标题栏（充满高度，宽度由 Header 校准面板决定） ============ */}
      <aside
        style={{
          width: isMobile ? '100%' : `${headerCalib.sidebarW}px`,
          // 桌面端：固定侧栏高度 = 整屏高度，Header 在里面按 sidebarAlignX/Y 定位
          height: isMobile ? 'auto' : '100vh',
          flexShrink: 0,
        }}
      >
        <Header />
      </aside>

      {/* ============ 右侧：房间（状态栏已按用户要求删除） ============ */}
      <main className="flex-1 flex flex-col items-center gap-4 pt-4">
        <RoomScene
          weather={weather}
          timePhase={timePhase}
          now={now}
          hoveredId={hoveredId}
          onHotspotClick={handleHotspotClick}
          onHotspotHover={setHoveredId}
          roomAlignX={headerCalib.roomAlignX}
          roomMaxW={headerCalib.roomMaxW}
          roomOffsetXPx={headerCalib.roomOffsetXPx}
          roomContentGapXPx={headerCalib.roomContentGapXPx}
          onWindowClick={toggleWeather}
        />
      </main>

      {/* Themed cards（弹窗卡片仍然挂在外层，不受左右栏影响） */}
      {categoryDefs.map((cat) => (
        <ThemedCard
          key={cat.key}
          category={cat}
          isOpen={activeCategory === cat.key}
          onClose={handlePanelClose}
          canEdit={isAdmin}
        />
      ))}
    </div>
  );
}

export default App;
