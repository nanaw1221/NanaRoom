// ============================================================
// Supabase 客户端封装
// 核心设计：
//  - 配置缺失时自动降级为「本地 localStorage 模式」（旧行为完全不变）
//  - 配置存在时：读取用公共匿名账号（只读），写操作用管理员已登录用户
// ============================================================
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseClientTyped = SupabaseClient;

// Vite 环境变量（VITE_ 前缀才会暴露到前端）
const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * 是否已配置 Supabase
 *  - 没配置 → 保持旧的 localStorage 单机模式（本地模式）
 *  - 已配置 → Supabase 云端模式（跨设备同步 + 访客只读）
 */
export const IS_SUPABASE_CONFIGURED =
  typeof VITE_SUPABASE_URL === 'string' &&
  VITE_SUPABASE_URL.length > 0 &&
  typeof VITE_SUPABASE_ANON_KEY === 'string' &&
  VITE_SUPABASE_ANON_KEY.length > 0;

/**
 * Supabase 单例客户端（只在配置存在时实例化，避免未配置时 console 报错）
 */
export const supabase: SupabaseClientTyped | null = IS_SUPABASE_CONFIGURED
  ? createClient(VITE_SUPABASE_URL!, VITE_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,            // localStorage 持久化登录态
        autoRefreshToken: true,          // 自动刷新 token
        detectSessionInUrl: true,        // 支持 magic link / OAuth 的 URL 回跳
      },
    })
  : null;

/**
 * 存储桶名称（存上传的照片/封面图）
 * 请先在 Supabase 控制台 → Storage 中创建一个 public bucket，名字就叫 `record-images`
 */
export const STORAGE_BUCKET_IMAGES = 'record-images';

/**
 * 公开访问的照片 URL 前缀（用于 <img src> 直接展示）
 *   `${storagePublicUrlPrefix}/${path}`  → 就是这张图的公网地址
 */
export const storagePublicUrlPrefix = IS_SUPABASE_CONFIGURED
  ? `${VITE_SUPABASE_URL!}/storage/v1/object/public/${STORAGE_BUCKET_IMAGES}`
  : null;
