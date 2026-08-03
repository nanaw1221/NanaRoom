/*
 * 管理员登录 / 退出 弹窗组件
 * 触发：Header 里的标题图"连点 5 次"（隐藏入口，别人点不进来）
 */
import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminLoginModal({ open, onClose }: Props) {
  const {
    isAdmin,
    isConfigured,
    user,
    migrationStatus,
    triggerMigration,
    signInWithPassword,
    signOut,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrMsg(null);
    const { error } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (error) setErrMsg(error);
    else {
      setPassword('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(66, 58, 46, 0.55)', backdropFilter: 'blur(4px)' }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[22px] p-6 shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, #fff8e8 0%, #ffe8d0 100%)',
              border: '3px solid #4a3e35',
              fontFamily: "'ZCOOL KuaiLe','Fredoka',sans-serif",
              color: '#4a3e35',
            }}
          >
            {/* 顶部 */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ letterSpacing: '1px' }}>
                  {isAdmin ? '🛡 管理员模式' : '🔐 管理员登录'}
                </h2>
                <p className="text-[12px]" style={{ color: '#8b7558', letterSpacing: '0.3px' }}>
                  {isConfigured
                    ? isAdmin
                      ? '当前已登录，你可以增/删/改所有记录'
                      : '请使用管理员邮箱 + 密码登录'
                    : '未配置 Supabase，默认本机为管理员模式'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition hover:brightness-95"
                style={{ background: '#fff', border: '2px solid #4a3e35', color: '#4a3e35', fontSize: '16px' }}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            {/* 已登录态 */}
            {isAdmin ? (
              <div>
                {user?.email && (
                  <div
                    className="rounded-xl p-3 mb-3"
                    style={{
                      background: '#fff',
                      border: '2px dashed #c8b494',
                      color: '#6a5338',
                      fontSize: '13px',
                    }}
                  >
                    👤 当前管理员邮箱：
                    <span className="ml-1 font-bold">{user.email}</span>
                  </div>
                )}

                {/* 本地数据 → 云端同步状态（迁移状态） */}
                {isConfigured && (
                  <div className="rounded-xl p-3 mb-4 text-[12px]"
                    style={{
                      background: '#fffdf7',
                      border: '2px solid #d9c8aa',
                      color: '#6a5338',
                    }}>
                    <div className="mb-1.5 font-bold text-[13px] flex items-center gap-2" style={{ color: '#5a4223', letterSpacing: '0.5px' }}>
                      <span>☁️</span><span>本地数据 → 云端同步</span>
                    </div>
                    {migrationStatus?.running && (
                      <div className="flex items-center gap-2 text-[#8b6a48]">
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-[#c99a6b] border-t-transparent animate-spin" />
                        正在同步（照片多的时候请耐心等 10~30 秒）…
                      </div>
                    )}
                    {migrationStatus && !migrationStatus.running && migrationStatus.result && (
                      <div className="leading-relaxed">
                        {migrationStatus.result.skipped ? (
                          <span>ℹ️ {migrationStatus.result.skipped}</span>
                        ) : (
                          <>
                            ✅ 同步成功：已同步
                            <span className="mx-1 font-bold text-[#6a5338]">{migrationStatus.result.recordsMigrated}</span>条记录，
                            <span className="mx-1 font-bold text-[#6a5338]">{migrationStatus.result.photosUploaded}</span>张照片转存云端
                          </>
                        )}
                        <button
                          type="button"
                          onClick={triggerMigration}
                          className="block mt-2 px-3 py-1 rounded-lg transition active:translate-y-[1px]"
                          style={{
                            background: '#ffe6c6',
                            border: '1.5px solid #c99a6b',
                            color: '#5a4223',
                            fontSize: '11px',
                            fontFamily: "'Fredoka','Nunito',sans-serif",
                          }}
                        >
                          🔁 重新从本地上传到云端（想重新同步就点这个）
                        </button>
                      </div>
                    )}
                    {migrationStatus?.error && (
                      <div style={{ color: '#a8412e' }}>⚠️ 同步出错：{migrationStatus.error}</div>
                    )}
                    {!migrationStatus && (
                      <div className="flex items-center justify-between">
                        <span className="opacity-70">（首次登录会自动同步）</span>
                        <button
                          type="button"
                          onClick={triggerMigration}
                          className="px-3 py-1 rounded-lg transition active:translate-y-[1px]"
                          style={{
                            background: '#ffe6c6',
                            border: '1.5px solid #c99a6b',
                            color: '#5a4223',
                            fontSize: '11px',
                            fontFamily: "'Fredoka','Nunito',sans-serif",
                          }}
                        >
                          ▶ 立即同步
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => { await signOut(); onClose(); }}
                  disabled={!isConfigured}
                  className="w-full py-2.5 rounded-xl text-[14px] font-bold transition active:translate-y-[1px] disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(180deg, #d9bf99 0%, #b09372 100%)',
                    color: '#4a3e35',
                    border: '2.5px solid #4a3e35',
                    letterSpacing: '1px',
                  }}
                >
                  {isConfigured ? '🚪 退出登录' : '本地模式无需退出'}
                </button>
              </div>
            ) : (
              /* 未登录：表单 */
              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[12px] mb-1" style={{ color: '#6a5338', letterSpacing: '0.8px' }}>邮箱</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 rounded-xl outline-none"
                    style={{
                      background: '#fff',
                      border: '2.5px solid #c8b494',
                      color: '#4a3e35',
                      fontSize: '14px',
                      fontFamily: "'Fredoka','Nunito',sans-serif",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] mb-1" style={{ color: '#6a5338', letterSpacing: '0.8px' }}>密码</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl outline-none"
                    style={{
                      background: '#fff',
                      border: '2.5px solid #c8b494',
                      color: '#4a3e35',
                      fontSize: '14px',
                      fontFamily: "'Fredoka','Nunito',sans-serif",
                    }}
                  />
                </div>
                {errMsg && (
                  <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: '#fff1ef', color: '#a8412e', border: '1.5px solid #e3a599' }}>
                    ⚠ {errMsg}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 py-2.5 rounded-xl text-[14px] font-bold transition active:translate-y-[1px] disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(180deg, #e9c593 0%, #c99a6b 100%)',
                    color: '#3c2e1d',
                    border: '2.5px solid #4a3e35',
                    letterSpacing: '1.5px',
                  }}
                >
                  {submitting ? '登录中…' : '✅ 登录（管理员）'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
