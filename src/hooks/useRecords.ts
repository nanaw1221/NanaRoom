// ============================================================
// useRecords  ·  记录 CRUD
// ============================================================
// 双模式：
//  ① 云端模式（已配置 Supabase + 管理员登录）
//        - 读：所有人可读取 records 表（公共匿名 select）
//        - 写：只有管理员（RLS 限定指定邮箱）可增/改/删
//        - 图片：上传到 Storage 桶 record-images（公开读）
//  ② 本地模式（未配置 Supabase，或未登录）
//        - 读/写都走 localStorage（和之前单机行为 100% 一致）
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import type { AnyRecord, RecordCategory } from '../types/records';
import {
  supabase,
  IS_SUPABASE_CONFIGURED,
  STORAGE_BUCKET_IMAGES,
  storagePublicUrlPrefix,
} from '../lib/supabase';
import { useAuth } from './useAuth';

const STORAGE_PREFIX = 'na_';
const LEGACY_LOCAL_KEY = 'na-records';    // 兼容旧版本存储（老用户的数据不能丢！）

function storageKey(category: RecordCategory): string {
  return `${STORAGE_PREFIX}${category}`;
}

/* ---------- 本地模式 helpers（旧行为 100% 兼容） ---------- */
function loadLocal<T extends AnyRecord>(category: RecordCategory): T[] {
  try {
    // 1) 先尝试分分类的 key
    const raw = localStorage.getItem(storageKey(category));
    if (raw) return JSON.parse(raw) as T[];
    // 2) 兼容旧版本 key：na-records 里所有分类混在一起
    const legacy = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (legacy) {
      const arr = (JSON.parse(legacy) as any[]).filter((r: any) => r.category === category) as T[];
      // 迁移过来：存分类 key（下次就直接读分类 key）
      localStorage.setItem(storageKey(category), JSON.stringify(arr));
      return arr;
    }
    return [];
  } catch {
    return [];
  }
}
function saveLocal<T extends AnyRecord>(category: RecordCategory, arr: T[]): void {
  localStorage.setItem(storageKey(category), JSON.stringify(arr));
}
function genLocalId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 图片上传：Storage 桶 / localStorage base64 fallback ---------- */
/**
 * 把 File 转 base64（本地模式 fallback）
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * 上传图片
 * - 云端模式 + 管理员：上传到 Supabase Storage → 返回公开 URL
 * - 其他：base64 内联（和旧行为一致）
 */
export async function uploadRecordImage(file: File, opts?: { category?: RecordCategory }): Promise<string> {
  if (IS_SUPABASE_CONFIGURED && supabase) {
    // 用真实的 auth.getUser() 判断，而不是 localStorage hack
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const safeExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const ext = /^(jpg|jpeg|png|gif|webp|bmp)$/.test(safeExt) ? safeExt : 'jpg';
        const category = opts?.category ?? 'misc';
        const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET_IMAGES)
          .upload(path, file, { cacheControl: '31536000', upsert: false });
        if (!error) {
          return `${storagePublicUrlPrefix}/${path}`;
        }
        // 上传失败：fallback 到 base64，保证能存
      }
    } catch {
      // auth 挂了就 fallback，不给用户报错
    }
  }
  // 本地模式 / 未登录 / 上传失败 → base64 内联（兼容旧行为）
  return fileToBase64(file);
}

/* ============================================================
 *  主 hook
 * ============================================================ */
export function useRecords<T extends AnyRecord>(category: RecordCategory) {
  const { isConfigured, isAdmin } = useAuth();

  const [records, setRecords] = useState<T[]>(() => loadLocal<T>(category));
  const [loading, setLoading] = useState<boolean>(isConfigured);
  const [syncedCategory, setSyncedCategory] = useState<RecordCategory>(category);

  /* ---------- 云端模式：首次挂载 / category 切换时拉一次 records 表 ---------- */
  useEffect(() => {
    setSyncedCategory(category);
    if (!isConfigured || !supabase) {
      setRecords(loadLocal<T>(category));
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false });
      if (!alive) return;
      if (error || !data) {
        // 拉失败（比如 RLS 表还没建好） → fallback 本地，保证页面能看
        setRecords(loadLocal<T>(category));
      } else {
        // 把 Supabase 行映射成前端需要的 AnyRecord shape
        //   注意：AnyRecord 所有子类型图片字段统一叫 `image`，不是 imageUrl
        //   扩展字段（extra JSON）：author / artist / location / content 等
        const mapped: T[] = data.map((row: any) => {
          const extra = row.extra && typeof row.extra === 'object' ? row.extra : {};
          return {
            id: String(row.id),
            category: row.category,
            title: row.title ?? (extra as any).title ?? '',
            image: row.image_url ?? (extra as any).image ?? undefined,
            rating: row.rating ?? (extra as any).rating ?? undefined,
            date: row.date ?? (extra as any).date ?? undefined,
            description: row.description ?? (extra as any).review ?? (extra as any).content ?? undefined,
            review: row.description ?? (extra as any).review ?? undefined,
            content: row.description ?? (extra as any).content ?? undefined,
            tags: Array.isArray(row.tags) ? (row.tags as string[]) : ((extra as any).tags ?? []),
            createdAt: row.created_at ?? new Date().toISOString(),
            updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
            ...extra,
          } as T;
        });
        setRecords(mapped);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isConfigured, category, supabase]);

  /* ---------- 本地模式：records 变 → 写回 localStorage ---------- */
  useEffect(() => {
    if (!isConfigured && syncedCategory === category) {
      saveLocal(category, records);
    }
  }, [isConfigured, category, syncedCategory, records]);

  /* ---------- 增：addRecord ---------- */
  const addRecord = useCallback(
    async (data: Omit<T, 'id' | 'category' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();

      // 1) 前端立即更新（乐观更新）
      const optimistic: T = {
        ...(data as any),
        id: genLocalId(),
        category,
        createdAt: now,
        updatedAt: now,
      } as T;
      setRecords((prev) => [optimistic, ...prev]);

      // 2) 云端模式 + 管理员 → 远程写入
      if (isConfigured && isAdmin && supabase) {
        const anyO = optimistic as any;
        const img = anyO.image ?? anyO.imageUrl;
        const finalDesc = anyO.description ?? anyO.review ?? anyO.content;
        const finalDate = anyO.date ?? anyO.readDate ?? anyO.watchDate;
        // 把非通用字段丢到 extra JSONB（author / artist / location / content 等）
        const commonKeys = new Set(['id', 'category', 'createdAt', 'updatedAt', 'image', 'imageUrl', 'title', 'description', 'review', 'content', 'date', 'readDate', 'watchDate', 'tags', 'rating']);
        const extra: Record<string, any> = {};
        for (const k of Object.keys(anyO)) {
          if (!commonKeys.has(k) && anyO[k] !== undefined && anyO[k] !== null) extra[k] = anyO[k];
        }
        if (anyO.author)   extra.author   = anyO.author;
        if (anyO.artist)   extra.artist   = anyO.artist;
        if (anyO.location) extra.location = anyO.location;

        const payload: Record<string, any> = {
          category,
          title: anyO.title ?? null,
          description: finalDesc ?? null,
          image_url: img ?? null,
          rating: typeof anyO.rating === 'number' ? anyO.rating : null,
          date: finalDate ?? null,
          tags: Array.isArray(anyO.tags) ? anyO.tags : [],
          extra: Object.keys(extra).length ? extra : null,
        };
        const { data: inserted, error } = await supabase
          .from('records')
          .insert(payload)
          .select('*')
          .single();
        if (!error && inserted) {
          // 成功：把本地临时 id 换成远程真实 id
          setRecords((prev) =>
            prev.map((r) => (r.id === optimistic.id ? { ...r, id: String(inserted.id) } : r)),
          );
          return optimistic;
        }
      }
      return optimistic;
    },
    [category, isConfigured, isAdmin, supabase],
  );

  /* ---------- 改：updateRecord ---------- */
  const updateRecord = useCallback(
    async (id: string, patch: Partial<T>) => {
      const now = new Date().toISOString();
      // 乐观更新
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...(patch as any), updatedAt: now } as T : r)),
      );
      if (isConfigured && isAdmin && supabase) {
        const anyP = patch as any;
        const img = anyP.image ?? anyP.imageUrl;
        const finalDesc = anyP.description ?? anyP.review ?? anyP.content;
        const finalDate = anyP.date ?? anyP.readDate ?? anyP.watchDate;
        const commonKeys = new Set(['id', 'category', 'createdAt', 'updatedAt', 'image', 'imageUrl', 'title', 'description', 'review', 'content', 'date', 'readDate', 'watchDate', 'tags', 'rating']);
        const extraPatch: Record<string, any> = {};
        for (const k of Object.keys(anyP)) {
          if (!commonKeys.has(k) && anyP[k] !== undefined) extraPatch[k] = anyP[k];
        }
        if (anyP.author)   extraPatch.author   = anyP.author;
        if (anyP.artist)   extraPatch.artist   = anyP.artist;
        if (anyP.location) extraPatch.location = anyP.location;

        const payload: Record<string, any> = { updated_at: now };
        if ('title' in anyP) payload.title = anyP.title ?? null;
        if (finalDesc !== undefined) payload.description = finalDesc ?? null;
        if (img !== undefined) payload.image_url = img ?? null;
        if ('rating' in anyP) payload.rating = typeof anyP.rating === 'number' ? anyP.rating : null;
        if (finalDate !== undefined) payload.date = finalDate ?? null;
        if ('tags' in anyP) payload.tags = Array.isArray(anyP.tags) ? anyP.tags : [];
        // 简单策略：先 select 原 extra → Object.assign → update（个人站并发为0，足够）
        if (Object.keys(extraPatch).length) {
          try {
            const { data: old } = await supabase
              .from('records')
              .select('extra')
              .eq('id', Number.isFinite(Number(id)) ? Number(id) : id)
              .maybeSingle();
            payload.extra = { ...((old as any)?.extra ?? {}), ...extraPatch };
          } catch { /* ignore, just update other fields */ }
        }
        await supabase.from('records').update(payload).eq('id', Number.isFinite(Number(id)) ? Number(id) : id);
      }
    },
    [isConfigured, isAdmin, supabase],
  );

  /* ---------- 删：deleteRecord ---------- */
  const deleteRecord = useCallback(
    async (id: string) => {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (isConfigured && isAdmin && supabase) {
        await supabase.from('records').delete().eq('id', Number.isFinite(Number(id)) ? Number(id) : id);
      }
    },
    [isConfigured, isAdmin, supabase],
  );

  /* ---------- 查：getRecord ---------- */
  const getRecord = useCallback((id: string) => records.find((r) => r.id === id) ?? null, [records]);

  return { records, loading, addRecord, updateRecord, deleteRecord, getRecord };
}
