// ============================================================
// 管理员登录态 hook（useAuth）
// 核心设计：
//  - 未配置 Supabase → 自动认为是「管理员模式」(单机本地模式，和旧行为一致)
//  - 配置 Supabase 后
//      · 未登录 → 访客（只可以读，不可以写）
//      · 登录邮箱 且 邮箱 = 项目 auth.users 里的邮箱
//        → 在 Supabase RLS 层单独限定"只有这个邮箱能写 records 表"
//  - 管理员首次登录成功：自动执行 localStorage → Supabase 迁移
//    （旧单机数据 + 上传的 base64 照片自动进云端 Storage）
// ============================================================
import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode, useRef } from 'react';
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase';
import { runLocalToSupabaseMigration } from '../lib/migrateLocalToSupabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextValue {
  isConfigured: boolean;                // 是否配置了 Supabase（没配置=本地模式，全是管理员）
  isAdmin: boolean;                     // 当前是不是管理员（有权增删改）
  isGuest: boolean;                     // 当前是不是访客（只有读）
  isLoading: boolean;                   // 是不是在加载登录态
  session: Session | null;              // Supabase session
  user: User | null;                    // 登录后的用户（admin 本人）
  /** 本地 → 云端迁移状态：给 AdminLoginModal 展示结果用 */
  migrationStatus: null | { running: boolean; result?: { recordsMigrated: number; photosUploaded: number; skipped?: string } | null; error?: string };
  triggerMigration: () => Promise<void>; // 手动触发迁移（登录弹窗里的"重新同步本地"按钮）
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<AuthContextValue['migrationStatus']>(null);
  const prevUserRef = useRef<User | null>(null);

  // --- 本地 → 云端迁移（只跑一次，管理员从"未登录→已登录"触发） ---
  const triggerMigration = useCallback(async () => {
    if (!IS_SUPABASE_CONFIGURED) return;
    try {
      setMigrationStatus({ running: true });
      const res = await runLocalToSupabaseMigration();
      setMigrationStatus({ running: false, result: res });
    } catch (e: any) {
      setMigrationStatus({ running: false, error: String(e?.message ?? e) });
    }
  }, []);

  // --- 初始化：加载本地已存的登录态 + 监听变化 ---
  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !supabase) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    // 1. 先取一次当前 session（带超时保护，防止 getSession 卡住导致 isLoading 永远为 true）
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const nextUser = data.session?.user ?? null;
        const wasLogged = !!prevUserRef.current;
        prevUserRef.current = nextUser;
        setSession(data.session);
        setUser(nextUser);
        setIsLoading(false);
        // 首次挂载就发现已登录（上次登录了没退出）→ 触发一次迁移
        if (nextUser && !wasLogged) {
          void triggerMigration();
        }
      } catch (e) {
        console.error('[useAuth] getSession 异常:', e);
        if (mounted) setIsLoading(false);
      }
    })();

    // 超时保护：3 秒后强制结束 loading，防止网络问题导致永久卡死
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setIsLoading((prev) => {
          if (prev) console.warn('[useAuth] getSession 超时 3s，强制结束 loading');
          return false;
        });
      }
    }, 3000);

    // 2. 订阅登录/登出事件
    const { data: listener } = supabase.auth.onAuthStateChange((evt, next) => {
      const nextUser = next?.user ?? null;
      const wasLogged = !!prevUserRef.current;
      prevUserRef.current = nextUser;
      setSession(next);
      setUser(nextUser);
      setIsLoading(false);
      // SIGNED_IN：从未登录→登录成功 → 自动迁移
      if (evt === 'SIGNED_IN' && nextUser && !wasLogged) {
        void triggerMigration();
      }
    });
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      listener?.subscription.unsubscribe();
    };
  }, [triggerMigration]);

  // --- 邮箱密码登录 ---
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: '未配置 Supabase，无法登录' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }, []);

  // --- 登出 ---
  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  // --- 权限判断 ---
  const isAdmin = IS_SUPABASE_CONFIGURED ? !!user : true;
  //   ↑ 本地模式（未配置 Supabase）：永远是管理员，和旧行为完全一致
  //   ↑ 云端模式（已配置 Supabase）：只有登录了才是管理员
  const isGuest = IS_SUPABASE_CONFIGURED ? !user : false;

  const value: AuthContextValue = useMemo(() => ({
    isConfigured: IS_SUPABASE_CONFIGURED,
    isAdmin,
    isGuest,
    isLoading,
    session,
    user,
    migrationStatus,
    triggerMigration,
    signInWithPassword,
    signOut,
  }), [isAdmin, isGuest, isLoading, session, user, migrationStatus, triggerMigration, signInWithPassword, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth 必须在 <AuthProvider> 里使用');
  return v;
}
