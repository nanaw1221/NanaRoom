/* ============================================================
 *  本地 localStorage → Supabase 云端 自动迁移
 * ============================================================
 *  触发时机：管理员登录成功后，useAuth.user 从 null → 有值，
 *           且 localStorage 迁移标记 'na-migrated' 不存在。
 *  迁移流程：
 *    1. 读本地 6 个分类所有记录（含旧版 na-records 混合 key 自动兼容）
 *    2. 如果记录里的 imageUrl 是 base64（data:image/xxx;base64,...）
 *       就把 base64 解码成 Blob → 上传到 Storage 桶 record-images
 *       → 换回 Supabase 公开 URL（这样手机/其他设备也能看到图）
 *    3. 所有记录批量 insert 到 records 表
 *    4. 写 'na-migrated' 标记，下次登录不再重复迁移
 * ============================================================*/
import {
  supabase,
  IS_SUPABASE_CONFIGURED,
  STORAGE_BUCKET_IMAGES,
  storagePublicUrlPrefix,
} from '../lib/supabase';
import type { AnyRecord, RecordCategory } from '../types/records';

const CATEGORIES: RecordCategory[] = ['books', 'movies', 'notes', 'albums', 'travel', 'concerts'];
// ★ v2: 更新迁移标记，让旧版标记失效（用户确认全部清空重来）
const MIGRATED_KEY = 'na-migrated-v2';
// v2 只读 na2_ 前缀的数据（旧 na_ 前缀的 base64 数据不迁移，用户确认全部清空重来）
const KEY_ALIASES: Record<RecordCategory, string[]> = {
  books:    ['na2_books'],
  movies:   ['na2_movies'],
  notes:    ['na2_notes'],
  albums:   ['na2_albums'],
  travel:   ['na2_travel'],
  concerts: ['na2_concerts'],
};

function base64ToBlob(base64: string): Blob | null {
  try {
    // data:image/png;base64,iVBORw0KGgoAAA...
    const m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/.exec(base64);
    if (!m) return null;
    const mime = m[1];
    const binary = atob(m[2]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function guessExtFromMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/jpg': return 'jpg';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/bmp': return 'bmp';
    default: return 'png';
  }
}

async function uploadBase64ToStorage(category: RecordCategory, imageUrl: string): Promise<string | null> {
  if (!imageUrl.startsWith('data:image/')) return imageUrl;    // 已经是 http URL，不变
  if (!supabase) return null;                                    // 没配置 Supabase，返回 null（不写 base64 入库）
  const blob = base64ToBlob(imageUrl);
  if (!blob) return null;                                        // 解码失败，返回 null
  const ext = guessExtFromMime(blob.type);
  const path = `${category}/migrate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET_IMAGES)
    .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: blob.type });
  if (error) {
    // ★ 关键修复：上传失败不返回原 base64（会导致数据库 image_url 字段存 1MB+ 的 base64）
    // 而是返回 null，让数据库 image_url 为 null，前端显示占位图
    console.error(`[migration] Storage 上传失败 (${category}):`, error.message);
    console.error('  → 请检查：1) bucket record-images 是否已创建  2) RLS 策略邮箱是否正确');
    return null;
  }
  return `${storagePublicUrlPrefix}/${path}`;
}

function readLocalAll(): Map<RecordCategory, AnyRecord[]> {
  const out = new Map<RecordCategory, AnyRecord[]>();
  for (const c of CATEGORIES) {
    try {
      let arr: AnyRecord[] | null = null;
      // 按别名依次尝试（v2 只读 na2_ 前缀）
      for (const alias of KEY_ALIASES[c]) {
        const raw = localStorage.getItem(alias);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as AnyRecord[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              arr = parsed;
              break;
            }
          } catch { /* ignore alias parse error */ }
        }
      }
      if (!arr) arr = [];
      out.set(c, arr);
    } catch {
      out.set(c, []);
    }
  }
  return out;
}

export async function runLocalToSupabaseMigration(): Promise<{
  ok: boolean;
  recordsMigrated: number;
  photosUploaded: number;
  skipped?: string;
}> {
  if (!IS_SUPABASE_CONFIGURED || !supabase) {
    return { ok: true, recordsMigrated: 0, photosUploaded: 0, skipped: '未配置 Supabase，跳过迁移' };
  }
  // 已迁过？跳过
  if (localStorage.getItem(MIGRATED_KEY) === '1') {
    return { ok: true, recordsMigrated: 0, photosUploaded: 0, skipped: '已迁移过，跳过' };
  }
  // 必须是登录态（否则 RLS 直接拒绝写入）
  const { data: who } = await supabase.auth.getUser();
  if (!who?.user) {
    return { ok: false, recordsMigrated: 0, photosUploaded: 0, skipped: '未登录管理员，跳过' };
  }

  const all = readLocalAll();
  let recordsMigrated = 0;
  let photosUploaded = 0;

  // 分类逐个处理（照片上传是串行，避免并发爆桶）
  for (const cat of CATEGORIES) {
    const list = all.get(cat) ?? [];
    if (!list.length) continue;

    const rows: Record<string, any>[] = [];
    for (const r of list) {
      // AnyRecord 里所有子类的图片字段：支持 images 数组（多图）和 image 单图
      const anyR = r as any;
      const imgs: string[] = Array.isArray(anyR.images) ? anyR.images : (anyR.image ? [anyR.image] : []);
      // 过滤掉 base64，只保留 URL
      const safeImgs = imgs.filter((u: string) => u && !u.startsWith('data:'));
      let url: string | null = safeImgs[0] ?? null;

      // 处理 base64 图片
      for (const img of imgs) {
        if (img.startsWith('data:image/')) {
          const newUrl = await uploadBase64ToStorage(cat, img);
          if (newUrl) {
            safeImgs.push(newUrl);
            photosUploaded++;
          }
        }
      }
      if (!url && safeImgs.length > 0) url = safeImgs[0];

      const {
        id: _id,
        category: _cat,
        createdAt,
        updatedAt,
        image: _img1,
        imageUrl: _img2,
        title,
        review,
        description,
        date,
        readDate,
        watchDate,
        tags,
        rating,
        author,
        artist,
        location,
        content,
        director,
        images: _imgs,
        ...extraRest
      } = anyR;

      const finalDate = date ?? readDate ?? watchDate ?? null;
      const finalDesc = description ?? review ?? content ?? null;

      const extraMerged: Record<string, any> = { ...extraRest };
      if (author)   extraMerged.author   = author;
      if (artist)   extraMerged.artist   = artist;
      if (location) extraMerged.location = location;
      if (rating)   extraMerged.rating   = rating;
      if (director) extraMerged.director = director;
      if (safeImgs.length > 0) extraMerged.images = safeImgs;

      rows.push({
        category: cat,
        title: title ?? null,
        description: finalDesc,
        image_url: url ?? null,
        rating: typeof rating === 'number' ? rating : null,
        date: finalDate,
        tags: Array.isArray(tags) ? tags : [],
        extra: Object.keys(extraMerged).length ? extraMerged : null,
        created_at: createdAt ?? new Date().toISOString(),
        updated_at: updatedAt ?? createdAt ?? new Date().toISOString(),
      });
    }

    // 分类分批 upsert（Supabase REST insert 最多 1000 条一次，个人项目够）
    if (rows.length) {
      const { error } = await supabase.from('records').insert(rows);
      if (error) {
        // 某一类失败不阻断其他类，继续
        console.warn(`[migration] 分类 ${cat} 写入失败：`, error);
      } else {
        recordsMigrated += rows.length;
      }
    }
  }

  localStorage.setItem(MIGRATED_KEY, '1');
  return { ok: true, recordsMigrated, photosUploaded };
}
