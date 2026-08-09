// ============================================================
// useRecords · 记录 CRUD（v2 · 2026-08-05 重写）
// ============================================================
// 设计原则：
//   1. localStorage 是真相源 —— 立即读写，绝不等待云端
//   2. Supabase 是同步层 —— 后台拉取/推送，失败不影响本地展示
//   3. 图片只存 Storage URL，绝不把 base64 写入数据库
//   4. 列表查询排除 image_url（大字段），按需懒加载
//   5. 本地模式（未配置 Supabase）→ 读写都走 localStorage
//      云端模式（配置了 Supabase）→ 本地缓存 + 云端同步
//        · 任何人都能读（RLS 公开读）
//        · 管理员能写（RLS 限定邮箱）
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { AnyRecord, RecordCategory } from '../types/records';
import {
  supabase,
  IS_SUPABASE_CONFIGURED,
  STORAGE_BUCKET_IMAGES,
  storagePublicUrlPrefix,
} from '../lib/supabase';
import { useAuth } from './useAuth';

// ★ v2: 更改前缀，让旧版 base64 缓存数据失效（用户确认全部清空重来）
const STORAGE_PREFIX = 'na2_';

function storageKey(category: RecordCategory): string {
  return `${STORAGE_PREFIX}${category}`;
}

function deletedKey(category: RecordCategory): string {
  return `${STORAGE_PREFIX}${category}_deleted`;
}

/* ---------- 本地存储 helpers ---------- */
function loadDeletedIds(category: RecordCategory): Set<string> {
  try {
    const raw = localStorage.getItem(deletedKey(category));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

function saveDeletedIds(category: RecordCategory, ids: Set<string>): void {
  try {
    localStorage.setItem(deletedKey(category), JSON.stringify([...ids]));
  } catch {}
}

/* ---------- 本地存储 helpers ---------- */
function loadLocal<T extends AnyRecord>(category: RecordCategory): T[] {
  try {
    const raw = localStorage.getItem(storageKey(category));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as T[]).sort((a, b) => {
          const ca = (a as any).createdAt ?? '';
          const cb = (b as any).createdAt ?? '';
          return ca.localeCompare(cb);
        });
      }
    }
    return [];
  } catch (e) {
    console.error(`[useRecords:${category}] loadLocal 解析失败:`, e);
    return [];
  }
}

function saveLocal<T extends AnyRecord>(category: RecordCategory, arr: T[]): void {
  try {
    localStorage.setItem(storageKey(category), JSON.stringify(arr));
  } catch (e) {
    console.error(`[useRecords:${category}] saveLocal 写入失败:`, e);
  }
}

function genLocalId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 图片上传（只存 Storage URL，不降级 base64）---------- */
export async function uploadRecordImage(file: File, opts?: { category?: RecordCategory }): Promise<string> {
  // 本地模式（未配置 Supabase）→ 降级为 base64 仅用于本地存储
  if (!IS_SUPABASE_CONFIGURED || !supabase) {
    return fileToBase64(file);
  }

  // 云端模式：必须登录管理员才能上传到 Storage
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      console.warn('[uploadRecordImage] 未登录管理员，图片仅存本地 base64');
      return fileToBase64(file);
    }

    const safeExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const ext = /^(jpg|jpeg|png|gif|webp|bmp)$/.test(safeExt) ? safeExt : 'jpg';
    const category = opts?.category ?? 'misc';
    const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET_IMAGES)
      .upload(path, file, { cacheControl: '31536000', upsert: false });

    if (error) {
      // Storage 上传失败：不降级为 base64 写入数据库，返回空字符串
      // 这样数据库里 image_url 为 null，前端显示占位图，而不是存 1MB 的 base64
      console.error('[uploadRecordImage] Storage 上传失败:', error.message);
      console.error('  → 请检查：1) bucket record-images 是否已创建  2) RLS 策略邮箱是否正确');
      throw new Error(`图片上传失败: ${error.message}（请确认 Storage 桶已创建且 RLS 邮箱正确）`);
    }

    return `${storagePublicUrlPrefix}/${path}`;
  } catch (e: any) {
    // 如果是我们自己 throw 的错误，直接向上抛
    if (e?.message?.startsWith('图片上传失败')) throw e;
    console.error('[uploadRecordImage] 异常:', e?.message ?? e);
    throw new Error(`图片上传异常: ${e?.message ?? String(e)}`);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/* ============================================================
 *  云端记录 → 本地记录 映射
 * ============================================================ */
function mapCloudRowToLocal<T extends AnyRecord>(row: any): T {
  const extra = row.extra && typeof row.extra === 'object' ? row.extra : {};
  // 向后兼容：旧数据用 image_url（单图），新数据用 extra.images（数组）
  const rawImages = extra.images;
  const legacyImg = row.image_url ?? extra.image ?? undefined;
  let images: string[] | undefined;
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    images = rawImages as string[];
  } else if (legacyImg && typeof legacyImg === 'string' && !legacyImg.startsWith('data:')) {
    images = [legacyImg];
  }
  return {
    id: String(row.id),
    category: row.category,
    title: row.title ?? extra.title ?? '',
    description: row.description ?? extra.description ?? undefined,
    review: row.description ?? extra.review ?? undefined,
    content: row.description ?? extra.content ?? undefined,
    rating: row.rating ?? extra.rating ?? undefined,
    date: row.date ?? extra.date ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : (extra.tags ?? []),
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    image: images?.[0] ?? legacyImg ?? undefined,
    images: images,
    author: extra.author ?? undefined,
    artist: extra.artist ?? undefined,
    location: extra.location ?? undefined,
    readDate: extra.readDate ?? undefined,
    watchDate: extra.watchDate ?? undefined,
    director: extra.director ?? undefined,
    ...extra,
  } as unknown as T;
}

/* ============================================================
 *  本地记录 → 云端 payload
 * ============================================================ */
function buildCloudPayload(record: any, category: RecordCategory): Record<string, any> {
  const imgs: string[] = Array.isArray(record.images) ? record.images : (record.image ? [record.image] : []);
  // ★ 关键修复：过滤掉 base64（不应写入数据库）
  const safeImages = imgs.filter((img: string) => img && !img.startsWith('data:'));
  const firstImage = safeImages[0] ?? null;

  const finalDesc = record.description ?? record.review ?? record.content ?? null;
  const finalDate = record.date ?? record.readDate ?? record.watchDate ?? null;

  // 这些字段是 records 表的独立列，其他都塞进 extra
  const columnKeys = new Set([
    'id', 'category', 'createdAt', 'updatedAt',
    'image', 'imageUrl', 'title', 'description', 'review', 'content',
    'date', 'readDate', 'watchDate', 'tags', 'rating', 'images',
  ]);
  const extra: Record<string, any> = {};
  for (const k of Object.keys(record)) {
    if (!columnKeys.has(k) && record[k] !== undefined && record[k] !== null && record[k] !== '') {
      extra[k] = record[k];
    }
  }
  // 显式确保关键字段进 extra
  if (record.author)   extra.author   = record.author;
  if (record.artist)   extra.artist   = record.artist;
  if (record.location) extra.location = record.location;
  if (record.director) extra.director = record.director;
  if (safeImages.length > 0) extra.images = safeImages;

  return {
    category,
    title: record.title ?? null,
    description: finalDesc,
    image_url: firstImage,
    rating: typeof record.rating === 'number' ? record.rating : null,
    date: finalDate,
    tags: Array.isArray(record.tags) ? record.tags : [],
    extra: Object.keys(extra).length ? extra : null,
  };
}

/* ============================================================
 *  主 hook
 * ============================================================ */
export function useRecords<T extends AnyRecord>(category: RecordCategory) {
  const { isConfigured, isAdmin, isLoading } = useAuth();

  // 本地数据立即加载，作为真相源
  const [records, setRecords] = useState<T[]>(() => loadLocal<T>(category));
  const [cloudSyncing, setCloudSyncing] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // ref 防止 effect 间竞态
  const fetchReqIdRef = useRef<number>(0);
  const hasFetchedCloudRef = useRef<boolean>(false);
  const deletedIdsRef = useRef<Set<string>>(loadDeletedIds(category));

  /* ---------- 云端拉取（仅一次：auth 就绪后触发） ---------- */
  useEffect(() => {
    if (!isConfigured || !supabase) return;
    if (isLoading) return;
    if (hasFetchedCloudRef.current) return;
    hasFetchedCloudRef.current = true;

    const reqId = ++fetchReqIdRef.current;
    setCloudSyncing(true);
    setCloudError(null);
    console.log(`[useRecords:${category}] 启动云端拉取 (reqId=${reqId})`);

    const fetchCloud = async (attempt: number): Promise<void> => {
      if (fetchReqIdRef.current !== reqId) return;
      try {
        // ★ 列表查询排除 image_url（大字段），按需懒加载
        const { data, error } = await supabase!
          .from('records')
          .select('id, category, title, description, rating, date, tags, extra, created_at, updated_at')
          .eq('category', category)
          .order('created_at', { ascending: true });

        if (fetchReqIdRef.current !== reqId) return;

        if (error || !data) {
          if (attempt < 2) {
            console.warn(`[useRecords:${category}] 拉取失败(第${attempt}次)，1.5秒后重试:`, error?.message);
            await new Promise((r) => setTimeout(r, 1500));
            if (fetchReqIdRef.current !== reqId) return;
            return fetchCloud(attempt + 1);
          }
          console.error(`[useRecords:${category}] 云端拉取彻底失败:`, error?.message);
          setCloudError(error?.message ?? '未知错误');
          return;
        }

        console.log(`[useRecords:${category}] 云端拉取成功: ${data.length} 条`);

        const cloud: T[] = data.map((row: any) => mapCloudRowToLocal<T>(row));

        // 合并策略：云端为主，过滤已删除ID，本地独有记录追加到末尾
        setRecords((prevLocal) => {
          const deletedSet = deletedIdsRef.current;
          const localMap = new Map(prevLocal.map((r: any) => [String(r.id), r]));
          const cloudIds = new Set(cloud.map((r: any) => String(r.id)));

          // 过滤掉已删除的记录（即使 cloud 有，也不回加）
          const filteredCloud = cloud.filter((c: any) => !deletedSet.has(String(c.id)));

          const merged: T[] = filteredCloud.map((c: any) => {
            const l = localMap.get(String(c.id));
            return l ? { ...l, ...c } as T : c as T;
          });

          const localOnly = prevLocal.filter((r: any) => !cloudIds.has(String(r.id)) && !deletedSet.has(String(r.id)));
          if (localOnly.length > 0) {
            console.log(`[useRecords:${category}] 合并云端 ${filteredCloud.length} + 本地独有 ${localOnly.length} 条`);
            merged.push(...localOnly);
          }

          saveLocal(category, merged);
          return merged;
        });
      } catch (e: any) {
        if (fetchReqIdRef.current !== reqId) return;
        if (attempt < 2) {
          console.warn(`[useRecords:${category}] 拉取异常(第${attempt}次)，1.5秒后重试:`, e?.message);
          await new Promise((r) => setTimeout(r, 1500));
          if (fetchReqIdRef.current !== reqId) return;
          return fetchCloud(attempt + 1);
        }
        console.error(`[useRecords:${category}] 云端拉取异常:`, e?.message);
        setCloudError(e?.message ?? String(e));
      }
    };

    fetchCloud(1).then(() => {
      if (fetchReqIdRef.current === reqId) {
        setCloudSyncing(false);
      }
    });
  }, [isConfigured, category, isLoading]);

  /* ---------- 懒加载：按需获取单条记录的图片 ---------- */
  const loadRecordDetails = useCallback(
    async (id: string): Promise<void> => {
      if (!isConfigured || !supabase) return;
      try {
        const numId = Number.isFinite(Number(id)) ? Number(id) : id;
        const { data, error } = await supabase
          .from('records')
          .select('id, image_url, extra')
          .eq('id', numId)
          .maybeSingle();

        if (error || !data) {
          console.warn(`[useRecords:${category}] 懒加载失败 (id=${id}):`, error?.message);
          return;
        }

        const imageUrl = (data as any).image_url ?? undefined;
        const extra = (data as any).extra && typeof (data as any).extra === 'object' ? (data as any).extra : {};

        // 向后兼容：旧单图 → 新数组
        const extraImages = extra.images;
        let images: string[] | undefined;
        if (Array.isArray(extraImages) && extraImages.length > 0) {
          images = extraImages;
        } else if (imageUrl && !imageUrl.startsWith('data:')) {
          images = [imageUrl];
        }
        const firstImg = images?.[0] ?? imageUrl ?? undefined;

        setRecords((prev) => {
          // 过滤掉已删除的记录（防止懒加载回加）
          if (deletedIdsRef.current.has(id)) return prev;

          const next = prev.map((r) => {
            if (r.id === id) {
              return {
                ...r,
                image: firstImg ?? (r as any).image,
                images: images ?? (r as any).images,
                ...extra,
              } as T;
            }
            return r;
          });
          saveLocal(category, next);
          return next;
        });
      } catch (e: any) {
        console.warn(`[useRecords:${category}] 懒加载异常 (id=${id}):`, e?.message);
      }
    },
    [category, isConfigured],
  );

  /* ---------- 增：addRecord ---------- */
  const addRecord = useCallback(
    async (data: Omit<T, 'id' | 'category' | 'createdAt' | 'updatedAt'>) => {
      // ★ 关键修复：验证 title 不为空
      const title = (data as any).title;
      if (!title || typeof title !== 'string' || !title.trim()) {
        throw new Error('标题不能为空');
      }

      const now = new Date().toISOString();
      const optimistic: T = {
        ...(data as any),
        id: genLocalId(),
        category,
        createdAt: now,
        updatedAt: now,
      } as T;

      // 1. 立即写本地（真相源）—— 新增记录追加到末尾
      setRecords((prev) => {
        const next = [...prev, optimistic];
        saveLocal(category, next);
        return next;
      });

      // 2. 云端写入（仅管理员）
      if (isConfigured && isAdmin && supabase) {
        const payload = buildCloudPayload(optimistic, category);
        try {
          const { data: inserted, error } = await supabase
            .from('records')
            .insert(payload)
            .select('*')
            .single();
          if (!error && inserted) {
            const realId = String(inserted.id);
            setRecords((prev) => {
              const next = prev.map((r) =>
                r.id === optimistic.id ? { ...r, id: realId } as T : r
              );
              saveLocal(category, next);
              return next;
            });
            console.log(`[useRecords:${category}] 云端写入成功，新 id=${realId}`);
          } else {
            console.warn(`[useRecords:${category}] 云端写入失败，已保留本地:`, error?.message);
          }
        } catch (e: any) {
          console.warn(`[useRecords:${category}] 云端写入异常，已保留本地:`, e?.message);
        }
      }
      return optimistic;
    },
    [category, isConfigured, isAdmin],
  );

  /* ---------- 改：updateRecord ---------- */
  const updateRecord = useCallback(
    async (id: string, patch: Partial<T>) => {
      const now = new Date().toISOString();

      // 1. 立即写本地
      setRecords((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, ...(patch as any), updatedAt: now } as T : r
        );
        saveLocal(category, next);
        return next;
      });

      // 2. 云端更新（仅管理员）
      if (isConfigured && isAdmin && supabase) {
        const numId = Number.isFinite(Number(id)) ? Number(id) : id;
        const payload = buildCloudPayload(patch, category);
        payload.updated_at = now;

        // extra 需要先读旧值再合并
        if (payload.extra) {
          try {
            const { data: old } = await supabase
              .from('records')
              .select('extra')
              .eq('id', numId)
              .maybeSingle();
            payload.extra = { ...((old as any)?.extra ?? {}), ...payload.extra };
          } catch { /* ignore */ }
        }

        try {
          const { error } = await supabase
            .from('records')
            .update(payload)
            .eq('id', numId);
          if (error) {
            console.warn(`[useRecords:${category}] 云端更新失败:`, error.message);
          }
        } catch (e: any) {
          console.warn(`[useRecords:${category}] 云端更新异常:`, e?.message);
        }
      }
    },
    [category, isConfigured, isAdmin],
  );

  /* ---------- 删：deleteRecord ---------- */
  const deleteRecord = useCallback(
    async (id: string) => {
      const numId = Number.isFinite(Number(id)) ? Number(id) : id;

      // 0. 先标记为已删除（防止 cloud fetch 合并回加）
      deletedIdsRef.current.add(String(id));
      saveDeletedIds(category, deletedIdsRef.current);

      // 1. 立即删本地
      setRecords((prev) => {
        const next = prev.filter((r) => r.id !== id);
        saveLocal(category, next);
        return next;
      });

      // 2. 云端删除（仅管理员）
      if (isConfigured && isAdmin && supabase) {
        try {
          const { error } = await supabase
            .from('records')
            .delete()
            .eq('id', numId);
          if (error) {
            console.error(`[useRecords:${category}] 云端删除失败 (id=${id}):`, error.message);
            alert(`删除失败：${error.message}\n\n记录已在本地标记删除，但云端可能未同步。请确认 RLS 策略邮箱是否正确。`);
          } else {
            console.log(`[useRecords:${category}] 云端删除成功 (id=${id})`);
            // 云端删除成功后，从 deletedIds 移除（已真正删除，无需追踪）
            // 但保留也无妨，作为双保险
          }
        } catch (e: any) {
          console.error(`[useRecords:${category}] 云端删除异常 (id=${id}):`, e?.message);
          alert(`删除异常：${e?.message ?? '未知错误'}\n\n记录已在本地标记删除。`);
        }
      }
    },
    [category, isConfigured, isAdmin],
  );

  /* ---------- 查：getRecord ---------- */
  const getRecord = useCallback((id: string) => records.find((r) => r.id === id) ?? null, [records]);

  return {
    records,
    loading: false,
    syncing: cloudSyncing,
    cloudError,
    addRecord,
    updateRecord,
    deleteRecord,
    getRecord,
    loadRecordDetails,
  };
}
