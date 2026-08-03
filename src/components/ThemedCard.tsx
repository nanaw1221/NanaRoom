import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AnyRecord, CategoryDef } from '../types/records';
import { useRecords } from '../hooks/useRecords';

interface ThemedCardProps {
  category: CategoryDef;
  isOpen: boolean;
  onClose: () => void;
  /** 当前是否可以编辑（管理员=true / 访客=false / 本地模式=默认true） */
  canEdit?: boolean;
}

type View = 'list' | 'add' | 'edit' | 'detail';

const MILKI_STROKE = '#5a4e42';
const MILKI_RED = '#d45a42';
const MILKI_CREAM = '#fff8ea';
const MILKI_PAPER = '#fffdf7';
const MILKI_BEIGE = '#f0e6d4'; // 浅米色用于通用按钮

// 字体配置：介于卡通和简洁之间
const FONT_DISPLAY = "'Fredoka','Nunito',sans-serif";     // 标题用 - 圆润但不幼稚
const FONT_BODY = "'Nunito','PingFang SC','Microsoft YaHei',sans-serif"; // 正文用 - 简洁清晰

/* ====== Milki Receipt 票据主题色（淡色调）======
   笔记本：米白   书架：木制棕   电影：浅黑
   专辑：紫粉     旅行：天蓝     演唱会：黑金
   所有色调尽量偏淡 */
interface ReceiptTheme {
  headBg: string;     // 顶部条带（淡色）
  accent: string;     // 装饰色
  accentBg: string;   // 辅助背景
  text: string;
  subText: string;
  inputBg: string;
  inputBorder: string;
  colorDots: [string, string, string]; // 顶部三个装饰圆点的颜色
  titleText: string;  // 顶部条带上的标题文字颜色（淡底用深色）
}

const receiptThemes: Record<string, ReceiptTheme> = {
  // 笔记本 - 米白（极浅米色）
  notes:    {
    headBg: '#f5efe3',
    accent: '#e4d6bb',
    accentBg: 'rgba(228,214,187,0.20)',
    text: MILKI_STROKE,
    subText: '#8c7560',
    inputBg: '#fbf7ee',
    inputBorder: 'rgba(228,214,187,0.70)',
    colorDots: ['#ffd9b0', '#ffe8c8', '#e8dcc4'],
    titleText: '#5a4a38',
  },
  // 书架 - 木制棕（淡棕色）
  books:    {
    headBg: '#d6bf9e',
    accent: '#c4aa86',
    accentBg: 'rgba(196,170,134,0.18)',
    text: MILKI_STROKE,
    subText: '#7a6a55',
    inputBg: '#faf5ec',
    inputBorder: 'rgba(196,170,134,0.60)',
    colorDots: ['#c4aa86', '#e8d4b0', '#d8c8a8'],
    titleText: '#4a3a28',
  },
  // 电影 - 浅黑（淡灰黑）
  movies:   {
    headBg: '#a8a29a',
    accent: '#8e8882',
    accentBg: 'rgba(142,136,130,0.16)',
    text: MILKI_STROKE,
    subText: '#6a625a',
    inputBg: '#f5f3f0',
    inputBorder: 'rgba(142,136,130,0.55)',
    colorDots: ['#8e8882', '#b8b2aa', '#a09a92'],
    titleText: '#3a3530',
  },
  // 专辑 - 紫粉（淡紫粉）
  albums:   {
    headBg: '#e6c8d8',
    accent: '#d4a8c0',
    accentBg: 'rgba(212,168,192,0.20)',
    text: MILKI_STROKE,
    subText: '#7a6a72',
    inputBg: '#fbf4f8',
    inputBorder: 'rgba(212,168,192,0.60)',
    colorDots: ['#e0a8c4', '#c8b0d8', '#f0c8d8'],
    titleText: '#5a4452',
  },
  // 旅行 - 天蓝（淡天蓝）
  travel:   {
    headBg: '#c4dcec',
    accent: '#a8c8e0',
    accentBg: 'rgba(168,200,224,0.20)',
    text: '#4a5a68',
    subText: '#7a8a98',
    inputBg: '#f3f8fc',
    inputBorder: 'rgba(168,200,224,0.60)',
    colorDots: ['#a8c8e0', '#c8d8f0', '#b8d0e8'],
    titleText: '#3a4a5a',
  },
  // 演唱会 - 黑金（淡金棕）
  concerts: {
    headBg: '#d8c498',
    accent: '#c0a878',
    accentBg: 'rgba(192,168,120,0.18)',
    text: MILKI_STROKE,
    subText: '#7a6a52',
    inputBg: '#faf5ea',
    inputBorder: 'rgba(192,168,120,0.60)',
    colorDots: ['#c0a878', '#e8d4a0', '#d0b888'],
    titleText: '#4a3a20',
  },
};

/* ===== Helpers ===== */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try { const d = new Date(dateStr); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  catch { return dateStr; }
}
function getTitle(r: AnyRecord): string {
  switch(r.category){ case 'books':return r.title||'未命名'; case 'movies':return r.title||'未命名'; case 'notes':return r.title||'无标题'; case 'albums':return r.title||'未命名'; case 'travel':return r.title||'未命名'; case 'concerts':return r.artist||'未命名'; default:return '未命名'; }
}
function getSubtitle(r: AnyRecord): string {
  switch(r.category){ case 'books':return r.author||''; case 'movies':return formatDate(r.watchDate); case 'notes':return formatDate(r.date); case 'albums':return r.artist||''; case 'travel':return `${r.location||''} ${formatDate(r.date)}`; case 'concerts':return `${r.location||''} ${formatDate(r.date)}`; default:return ''; }
}

// 判断是否使用网格布局的分类：专辑、电影、书架
const GRID_CATEGORIES = ['albums', 'movies', 'books'] as const;
function useGridView(categoryKey: string): boolean {
  return GRID_CATEGORIES.includes(categoryKey as typeof GRID_CATEGORIES[number]);
}



/* ===== Image Upload (Milki 票据风) ===== */
const ImageUpload = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  // 内部维护预览状态，实现即时UI反馈
  const [preview, setPreview] = useState<string>(value);

  // 当外部value变化时（比如加载编辑数据），同步更新预览
  useEffect(() => {
    setPreview(value);
  }, [value]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 文件类型校验
    if (!file.type.startsWith('image/')) {
      alert('只能上传图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);       // 立即更新预览，UI有反馈
      onChange(result);         // ★ 直接写入React状态（不再通过隐藏DOM中转）
    };
    reader.onerror = () => {
      alert('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);
    // 清空input value，允许再次选择同一文件
    e.target.value = '';
  };

  const handleRemove = () => {
    setPreview('');    // 立即清空预览
    onChange('');      // 通知外部
  };

  return (
    <div>
      {preview ? (
        <div className="relative inline-block group">
          <img src={preview} alt="上传预览" className="w-24 h-24 object-cover"
            style={{
              borderRadius: '12px',
              border: `3px solid ${MILKI_STROKE}`,
              boxShadow: '0 3px 0 #b8a588, 0 4px 10px rgba(74,62,53,0.18)',
            }} />
          <button type="button" onClick={handleRemove}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
            style={{
              backgroundColor: MILKI_RED,
              border: `2.5px solid ${MILKI_STROKE}`,
              boxShadow: '0 2px 0 #9a3a2a, 0 3px 6px rgba(74,62,53,0.2)',
              textShadow: '0 1px 0 rgba(0,0,0,0.3)',
            }}>×</button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{
            border: `2px dashed ${MILKI_STROKE}`,
            borderRadius: '12px',
            color: MILKI_STROKE,
            backgroundColor: MILKI_CREAM,
            boxShadow: '0 2px 0 #d4bf98, 0 3px 8px rgba(74,62,53,0.10)',
            fontFamily: FONT_DISPLAY,
            letterSpacing: '0.3px',
          }}>
          <span className="text-lg">📷</span> 点击上传图片
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

/* ===== 主组件：Milki Receipt 风格卡片 ===== */
const ThemedCard = ({ category, isOpen, onClose, canEdit = true }: ThemedCardProps) => {
  const { records, addRecord, updateRecord, deleteRecord } = useRecords<AnyRecord>(category.key);
  const [view, setView] = useState<View>('list');
  const [editingRecord, setEditingRecord] = useState<AnyRecord | null>(null);
  // ★ 关键修复：用React状态管理表单数据（不再依赖document.getElementById读DOM）
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const t = receiptThemes[category.key] || receiptThemes.notes;
  const isGridView = useGridView(category.key);

  // 初始化表单数据（进入add/edit视图时自动填充）
  const initFormData = useCallback((record?: AnyRecord | null) => {
    const data: Record<string, string | string[]> = {};
    category.fields.forEach((f) => {
      if (record) {
        const val = record[f.name as keyof typeof record];
        data[f.name] = Array.isArray(val) ? val : (typeof val === 'string' ? val : '');
      } else {
        data[f.name] = f.type === 'tags' ? [] : '';
      }
    });
    setFormData(data);
  }, [category.fields]);

  // 视图切换时自动初始化表单
  useEffect(() => {
    if (view === 'add') initFormData(null);
    else if (view === 'edit' && editingRecord) initFormData(editingRecord);
  }, [view, editingRecord, initFormData]);

  // 更新单个表单字段
  const updateFormField = useCallback((name: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetView = useCallback(() => {
    setView('list');
    setEditingRecord(null);
    setFormData({});
  }, []);

  const handleClose = useCallback(() => { resetView(); onClose(); }, [onClose, resetView]);

  // ★ 关键修复：直接从React状态读取数据保存（不再遍历DOM）
  const handleSave = useCallback(() => {
    const data: Record<string, string | string[]> = {};
    category.fields.forEach((f) => {
      const val = formData[f.name];
      if (f.type === 'tags') {
        data[f.name] = Array.isArray(val)
          ? val
          : typeof val === 'string' && val
            ? val.split(',').map((s) => s.trim()).filter(Boolean)
            : [];
      } else {
        data[f.name] = typeof val === 'string' ? val : '';
      }
    });
    if (view === 'edit' && editingRecord) {
      updateRecord(editingRecord.id, data as Partial<AnyRecord>);
    } else {
      addRecord(data as Omit<AnyRecord, 'id'|'category'|'createdAt'|'updatedAt'>);
    }
    resetView();
  }, [category.fields, formData, view, editingRecord, updateRecord, addRecord, resetView]);

  const handleDelete = (id: string) => { deleteRecord(id); if (view==='detail' && editingRecord?.id===id) resetView(); };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center pt-[6vh] sm:pt-[8vh] px-2">
          {/* 遮罩 - 稍微有一点暖色叠层 */}
          <motion.div className="absolute inset-0"
            style={{ backgroundColor: 'rgba(48,30,18,0.42)', backdropFilter: 'blur(2.5px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            onClick={handleClose} />

          <motion.div
            className="relative w-[88vw] sm:w-[84vw] max-w-[560px] max-h-[86vh] overflow-hidden flex flex-col"
            style={{
              backgroundColor: MILKI_PAPER,
              boxShadow: '0 6px 0 #8a6e54, 0 14px 32px rgba(74,62,53,0.30)',
              border: `2.5px solid ${MILKI_STROKE}`,
              borderRadius: '18px',
              fontFamily: FONT_BODY,
            }}
            initial={{ opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.9 }}
          >

              {/* ============== 顶部标题条（简洁 Milki 风） ============== */}
              <div className="relative shrink-0 px-5 sm:px-6 pt-5 pb-4"
                style={{
                  background: `linear-gradient(180deg, ${t.headBg} 0%, ${t.accentBg} 100%)`,
                  borderBottom: `2px solid ${MILKI_STROKE}`,
                }}>
                {/* 顶部三个 Milki 装饰圆点 - 缩小变淡 */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-80">
                  {t.colorDots.map((c, i) => (
                    <div key={`cd-${i}`} className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: c, border: `1.2px solid ${MILKI_STROKE}` }} />
                  ))}
                </div>
                {/* 标题行：图标 + 分类名 */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2.5">
                    {/* 分类 LOGO 小方块 */}
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: MILKI_CREAM,
                        border: `2px solid ${MILKI_STROKE}`,
                        boxShadow: '0 2px 0 rgba(74,62,53,0.20)',
                      }}>
                      <span className="text-base leading-none">{category.icon}</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold"
                      style={{
                        color: t.titleText,
                        letterSpacing: '0.5px',
                        fontFamily: FONT_DISPLAY,
                      }}>
                      {category.label}
                    </h2>
                  </div>
                  {/* 关闭按钮 - 更简洁 */}
                  <button type="button" onClick={handleClose}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: MILKI_CREAM,
                      border: `2px solid ${MILKI_STROKE}`,
                      color: MILKI_STROKE,
                      fontWeight: 700,
                      fontSize: '13px',
                      boxShadow: '0 2px 0 rgba(74,62,53,0.20)',
                    }}>
                    ✕
                  </button>
                </div>
              </div>

              {/* ============== 内容区 ============== */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 relative"
                style={{
                  /* 极简纸张纹理 - 非常淡的斑点 */
                  backgroundImage: `
                    radial-gradient(circle at 20% 30%, rgba(255,220,180,0.10) 0 1.5px, transparent 2.5px),
                    radial-gradient(circle at 80% 70%, rgba(255,200,150,0.08) 0 1.5px, transparent 2.5px)
                  `,
                  backgroundSize: '120px 140px, 100px 110px',
                }}>
                <AnimatePresence mode="wait">
                  {/* ---------- 列表视图 ---------- */}
                  {view === 'list' && (
                    <motion.div key="list" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                      {/* 表头 - 只保留统计数 */}
                      <div className="flex justify-end pb-3 mb-4"
                        style={{ borderBottom: `1.5px dashed ${MILKI_STROKE}`, opacity: 0.7 }}>
                        <span className="text-xs font-semibold" style={{ color: t.subText, fontFamily: FONT_DISPLAY, letterSpacing: '0.5px' }}>
                          共 {records.length} 条
                        </span>
                      </div>

                      {/* 添加按钮 - 仅管理员可见（访客隐藏） */}
                      {canEdit && (
                        <button type="button" onClick={() => { setView('add'); setEditingRecord(null); }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-5 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
                          style={{
                            backgroundColor: MILKI_BEIGE,
                            color: MILKI_STROKE,
                            border: `2px solid ${MILKI_STROKE}`,
                            borderRadius: '12px',
                            boxShadow: '0 3px 0 #c8b494, 0 5px 12px rgba(74,62,53,0.14)',
                            letterSpacing: '1px',
                            fontFamily: FONT_DISPLAY,
                          }}>
                          <span className="text-lg">＋</span> 添加新记录
                        </button>
                      )}

                      {records.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center gap-2">
                          <div className="text-4xl opacity-50">{category.icon}</div>
                          <p className="text-sm mt-2" style={{ color: t.subText, opacity: 0.75, fontFamily: FONT_BODY }}>
                            {canEdit ? category.emptyHint : '这里还没有记录～'}
                          </p>
                          {canEdit && (
                            <div className="mt-2 px-3 py-1 rounded-full text-[11px]"
                              style={{
                                backgroundColor: t.accentBg,
                                color: t.subText,
                                border: `1.5px dashed ${MILKI_STROKE}`,
                                opacity: 0.7,
                                fontFamily: FONT_DISPLAY,
                              }}>
                              点击上方按钮添加 ✨
                            </div>
                          )}
                        </div>
                      ) : isGridView ? (
                        /* ===== ★ 网格布局：专辑/电影/书架 使用九宫格书架形式 ===== */
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {records.map((r, i) => (
                            <motion.div key={r.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i*0.03, duration: 0.2 }}
                              className="group relative cursor-pointer transition-all hover:scale-[1.03] active:scale-[0.97]"
                              style={{
                                backgroundColor: MILKI_CREAM,
                                borderRadius: '10px 10px 4px 4px',
                                border: `2px solid ${MILKI_STROKE}`,
                                boxShadow: '0 3px 0 #c8b494, 0 5px 12px rgba(74,62,53,0.12), inset 0 -4px 0 rgba(74,62,53,0.08)',
                                overflow: 'hidden',
                              }}
                              onClick={() => { setEditingRecord(r); setView('detail'); }}>
                              {/* 图片缩略图区域（书架封面） */}
                              <div className="relative w-full aspect-[3/4] overflow-hidden"
                                style={{
                                  backgroundColor: t.accentBg,
                                  borderBottom: `2px solid ${MILKI_STROKE}`,
                                }}>
                                {(r as AnyRecord).image ? (
                                  <img src={(r as AnyRecord).image} alt={getTitle(r)}
                                    className="w-full h-full object-cover"
                                    loading="lazy" draggable={false} />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3"
                                    style={{ backgroundColor: t.accentBg }}>
                                    <span className="text-4xl opacity-60">{category.icon}</span>
                                    <p className="text-[11px] font-semibold text-center line-clamp-2"
                                       style={{ color: t.titleText, fontFamily: FONT_DISPLAY, opacity: 0.8 }}>
                                      {getTitle(r)}
                                    </p>
                                  </div>
                                )}
                                {/* 书脊高光效果 */}
                                <div className="absolute top-0 left-0 w-1.5 h-full"
                                  style={{
                                    background: 'linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)',
                                  }} />
                                {/* 序号标签（书架位置） */}
                                <div className="absolute bottom-1.5 right-1.5 px-1.5 h-4 rounded-md flex items-center justify-center text-[9px] font-bold"
                                  style={{
                                    backgroundColor: MILKI_CREAM,
                                    color: t.titleText,
                                    border: `1.5px solid ${MILKI_STROKE}`,
                                    fontFamily: FONT_DISPLAY,
                                    boxShadow: '0 1px 0 rgba(74,62,53,0.15)',
                                    lineHeight: 1,
                                  }}>
                                  {i+1}
                                </div>
                                {/* 删除按钮 —— 仅管理员可见（访客隐藏） */}
                                {canEdit && (
                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
                                    title="删除"
                                    style={{
                                      backgroundColor: MILKI_RED,
                                      color: 'white',
                                      border: `1.5px solid ${MILKI_STROKE}`,
                                      boxShadow: '0 1px 0 #9a3a2a',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      lineHeight: 1,
                                    }}>
                                    ×
                                  </button>
                                )}
                              </div>
                              {/* 文字信息区域（书架标签） */}
                              <div className="px-2 py-2">
                                <p className="text-xs font-semibold truncate"
                                  style={{ color: t.text, fontFamily: FONT_BODY, letterSpacing: '0.1px' }}>
                                  {getTitle(r)}
                                </p>
                                {getSubtitle(r) && (
                                  <p className="text-[10px] truncate mt-0.5"
                                    style={{ color: t.subText, opacity: 0.75 }}>
                                    {getSubtitle(r)}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        /* ===== 列表布局：笔记/旅行/演唱会 ===== */
                        <div className="space-y-3">
                          {records.map((r, i) => (
                            <motion.div key={r.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i*0.02, duration: 0.18 }}
                              className="group relative flex items-center gap-3 p-3 cursor-pointer transition-all hover:translate-x-[1px]"
                              style={{
                                backgroundColor: MILKI_CREAM,
                                borderRadius: '12px',
                                border: `2px solid ${MILKI_STROKE}`,
                                boxShadow: '0 2.5px 0 #c8b494, 0 4px 10px rgba(74,62,53,0.08)',
                              }}
                              onClick={() => { setEditingRecord(r); setView('detail'); }}>
                              {/* 条目左侧小序号 - 简化 */}
                              <div className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{
                                  backgroundColor: t.headBg,
                                  color: t.titleText,
                                  border: `1.5px solid ${MILKI_STROKE}`,
                                  fontFamily: FONT_DISPLAY,
                                }}>
                                {i+1}
                              </div>

                              {(r as AnyRecord).image && (
                                <img src={(r as AnyRecord).image} alt="" className="w-11 h-11 object-cover shrink-0"
                                  style={{ borderRadius: '9px', border: `2px solid ${MILKI_STROKE}` }} />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: t.text, letterSpacing: '0.2px', fontFamily: FONT_BODY }}>
                                  {getTitle(r)}
                                </p>
                                <p className="text-[11px] truncate mt-0.5" style={{ color: t.subText, opacity: 0.75 }}>
                                  {getSubtitle(r)}
                                </p>
                              </div>

                              {/* 右侧删除按钮 - 简化（仅管理员可见） */}
                              {canEdit && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all"
                                  title="删除"
                                  style={{
                                    backgroundColor: '#ffe6bf',
                                    border: `1.5px solid ${MILKI_STROKE}`,
                                    boxShadow: '0 1.5px 0 #c8a070',
                                  }}>
                                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M6 6.5v3M8 6.5v3M4.5 4l.5 7.5a1 1 0 001 1h2a1 1 0 001-1L9.5 4"
                                      stroke={MILKI_RED} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ---------- 添加 / 编辑表单（仅管理员可进入）---------- */}
                  {(view === 'add' || view === 'edit') && canEdit && (
                    <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.22 }} className="flex flex-col gap-4">
                      {/* 表单标题条 */}
                      <div className="flex items-center gap-2 pb-2 mb-1"
                        style={{ borderBottom: `1.5px dashed ${MILKI_STROKE}`, opacity: 0.8 }}>
                        <span className="text-base">{category.icon}</span>
                        <span className="font-bold" style={{ color: t.text, fontSize: '14px', fontFamily: FONT_DISPLAY, letterSpacing: '0.5px' }}>
                          {view === 'edit' ? '✎ 编辑条目' : '✚ 新建条目'}
                        </span>
                      </div>

                      {category.fields.map((field) => {
                        // ★ 修复：从React状态formData读取当前值
                        const fieldVal = formData[field.name];
                        const displayVal = Array.isArray(fieldVal)
                          ? fieldVal.join(', ')
                          : (typeof fieldVal === 'string' ? fieldVal : '');
                        if (field.type === 'image') return (
                          <div key={field.name} className="flex flex-col gap-2">
                            <label className="text-xs font-semibold" style={{ color: t.text, opacity: 0.8, fontFamily: FONT_DISPLAY, letterSpacing: '0.3px' }}>
                              {field.label}
                            </label>
                            {/* ★ 修复：onChange直接写入React状态（不再用隐藏DOM中转） */}
                            <ImageUpload
                              value={displayVal}
                              onChange={(v) => updateFormField(field.name, v)}
                            />
                          </div>
                        );
                        /* 通用输入样式：简洁 Milki 风 - 改为受控组件 */
                        const baseStyle: React.CSSProperties = {
                          backgroundColor: t.inputBg,
                          border: `2px solid ${MILKI_STROKE}`,
                          color: t.text,
                          borderRadius: '10px',
                          padding: '9px 13px',
                          fontSize: '14px',
                          fontWeight: 500,
                          boxShadow: '0 2px 0 #d4bf98',
                          outline: 'none',
                          fontFamily: FONT_BODY,
                        };
                        return (
                          <div key={field.name} className="flex flex-col gap-2">
                            <label className="text-xs font-black tracking-widest" style={{ color: t.text, opacity: 0.85 }}>
                              · {field.label} ·
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                value={displayVal}
                                onChange={(e) => updateFormField(field.name, e.target.value)}
                                rows={4}
                                placeholder={field.placeholder}
                                className="w-full resize-none" style={baseStyle}
                              />
                            ) : field.type === 'tags' ? (
                              <input
                                type="text"
                                value={displayVal}
                                onChange={(e) => updateFormField(field.name, e.target.value)}
                                placeholder={field.placeholder}
                                style={baseStyle}
                              />
                            ) : (
                              <input
                                type={field.type === 'date' ? 'date' : 'text'}
                                value={field.type === 'date' ? (displayVal ? displayVal.slice(0,10) : '') : displayVal}
                                onChange={(e) => updateFormField(field.name, e.target.value)}
                                placeholder={field.placeholder}
                                style={baseStyle}
                              />
                            )}
                          </div>
                        );
                      })}

                      {/* 保存 + 取消 */}
                      <div className="flex gap-3 mt-2">
                        {/* ★ 修复：保存按钮直接读取React状态（不再遍历DOM） */}
                        <button type="button" onClick={handleSave}
                          className="flex-1 py-2.5 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
                          style={{
                            backgroundColor: MILKI_BEIGE,
                            color: MILKI_STROKE,
                            border: `2px solid ${MILKI_STROKE}`,
                            borderRadius: '12px',
                            boxShadow: '0 3px 0 #c8b494, 0 5px 12px rgba(74,62,53,0.14)',
                            letterSpacing: '1px',
                            fontFamily: FONT_DISPLAY,
                          }}>
                          保存 ✓
                        </button>
                        <button type="button" onClick={resetView}
                          className="px-5 py-2.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                          style={{
                            backgroundColor: MILKI_CREAM,
                            color: MILKI_STROKE,
                            border: `2px solid ${MILKI_STROKE}`,
                            borderRadius: '12px',
                            boxShadow: '0 3px 0 #c8b494, 0 5px 10px rgba(74,62,53,0.10)',
                            letterSpacing: '0.5px',
                            fontFamily: FONT_DISPLAY,
                          }}>
                          取消
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ---------- 详情视图 ---------- */}
                  {view === 'detail' && editingRecord && (
                    <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.22 }}>
                      {/* 返回按钮 - 简洁 */}
                      <button type="button" onClick={resetView}
                        className="flex items-center gap-1.5 text-xs font-semibold mb-4 px-2.5 py-1.5 transition-all hover:scale-[1.02]"
                        style={{
                          color: MILKI_STROKE,
                          backgroundColor: MILKI_CREAM,
                          borderRadius: '9px',
                          border: `2px solid ${MILKI_STROKE}`,
                          boxShadow: '0 2px 0 #c8b494',
                          letterSpacing: '0.3px',
                          fontFamily: FONT_DISPLAY,
                        }}>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke={MILKI_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        返回清单
                      </button>

                      {/* 图片 */}
                      {(editingRecord as AnyRecord).image && (
                        <img src={(editingRecord as AnyRecord).image} alt="" className="w-full max-h-56 object-cover mb-5"
                          style={{
                            borderRadius: '14px',
                            border: `3px solid ${MILKI_STROKE}`,
                            boxShadow: '0 4px 0 #c8b494, 0 6px 16px rgba(74,62,53,0.18)',
                          }} />
                      )}

                      {/* 条目详情：每个字段一行 */}
                      <div className="space-y-3">
                        {category.fields.filter(f=>f.type!=='image').map((field) => {
                          const val = editingRecord[field.name as keyof typeof editingRecord];
                          const displayVal = field.type==='tags' && Array.isArray(val) ? val.join(', ')
                            : field.type==='date' && typeof val==='string' ? formatDate(val)
                            : typeof val==='string' ? val : '';
                          if (!displayVal) return null;
                          return (
                            <div key={field.name}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '11px',
                                backgroundColor: MILKI_CREAM,
                                border: `2px solid ${MILKI_STROKE}`,
                                boxShadow: '0 2px 0 #d4bf98',
                              }}>
                              <p className="text-[11px] mb-1 font-semibold" style={{ color: t.subText, opacity: 0.8, fontFamily: FONT_DISPLAY }}>
                                {field.label}
                              </p>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium"
                                style={{ color: t.text, fontFamily: FONT_BODY }}>
                                {displayVal}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* 编辑 & 删除按钮 —— 仅管理员可见 */}
                      {canEdit && (
                        <div className="mt-6 flex gap-3">
                          <button type="button" onClick={() => setView('edit')}
                            className="flex-1 py-2.5 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
                            style={{
                              backgroundColor: MILKI_BEIGE,
                              color: MILKI_STROKE,
                              border: `2px solid ${MILKI_STROKE}`,
                              borderRadius: '12px',
                              boxShadow: '0 3px 0 #c8b494, 0 5px 12px rgba(74,62,53,0.14)',
                              letterSpacing: '0.5px',
                              fontFamily: FONT_DISPLAY,
                            }}>
                            ✎ 编辑这条
                          </button>
                          <button type="button"
                            onClick={() => {
                              if (editingRecord && confirm('确定删除这条记录吗？')) {
                                handleDelete(editingRecord.id);
                              }
                            }}
                            className="py-2.5 px-4 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
                            style={{
                              backgroundColor: '#fff1ef',
                              color: MILKI_RED,
                              border: `2px solid ${MILKI_RED}`,
                              borderRadius: '12px',
                              boxShadow: '0 3px 0 #c9554a, 0 5px 12px rgba(74,62,53,0.14)',
                              letterSpacing: '0.5px',
                              fontFamily: FONT_DISPLAY,
                            }}>
                            🗑 删除
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ThemedCard;
