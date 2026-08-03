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
const MIGRATED_KEY = 'na-migrated-v1';
// 历史上旧版存储混用了不同的 key，比如 na-notebook / na-films / na-records
// 这里统一做兼容处理：先按新 key 读，读不到再读旧别名
const KEY_ALIASES: Record<RecordCategory, string[]> = {
  books:    ['na_books',    'na-books',    'na-bookshelf'],
  movies:   ['na_movies',   'na-movies',   'na-films'],
  notes:    ['na_notes',    'na-notes',    'na-notebook', 'na-journal'],
  albums:   ['na_albums',   'na-albums'],
  travel:   ['na_travel',   'na-travel',   'na-trip'],
  concerts: ['na_concerts', 'na-concerts', 'na-livehouse'],
};
const LEGACY_LOCAL_KEY = 'na-records';

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

async function uploadBase64ToStorage(category: RecordCategory, imageUrl: string): Promise<string> {
  if (!imageUrl.startsWith('data:image/')) return imageUrl;    // 已经是 http URL，不变
  if (!supabase) return imageUrl;
  const blob = base64ToBlob(imageUrl);
  if (!blob) return imageUrl;
  const ext = guessExtFromMime(blob.type);
  const path = `${category}/migrate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET_IMAGES)
    .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: blob.type });
  if (error) return imageUrl;                                    // 上传失败就保留原 base64
  return `${storagePublicUrlPrefix}/${path}`;
}

function readLocalAll(): Map<RecordCategory, AnyRecord[]> {
  const out = new Map<RecordCategory, AnyRecord[]>();
  for (const c of CATEGORIES) {
    try {
      let arr: AnyRecord[] | null = null;
      // 1) 按别名依次尝试
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
      // 2) 兼容旧版 na-records（所有分类混在一起）
      if (!arr) {
        const legacy = localStorage.getItem(LEGACY_LOCAL_KEY);
        if (legacy) {
          const parsed = (JSON.parse(legacy) as AnyRecord[]).filter((r: any) => r.category === c);
          if (parsed.length) arr = parsed;
        }
      }
      // 3) 正常默认空
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
      // AnyRecord 里所有子类的图片字段都是 image?（不是 imageUrl）
      const anyR = r as any;
      let url = anyR.image ?? anyR.imageUrl;  // 两种可能都兼容下
      if (url && url.startsWith('data:image/')) {
        const newUrl = await uploadBase64ToStorage(cat, url);
        if (newUrl !== url) photosUploaded++;
        url = newUrl;
      }

      // 把每分类的 扩展字段 + 通用字段 都落到 Supabase 的列：
      //   title / description(=review) / date(=readDate/watchDate/...) / image_url
      //   其余字段（author / artist / location / content / rating 等）统一丢到 extra JSONB
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
        ...extraRest
      } = anyR;

      const finalDate = date ?? readDate ?? watchDate ?? null;
      const finalDesc = description ?? review ?? content ?? null;

      const extraMerged: Record<string, any> = { ...extraRest };
      if (author)   extraMerged.author   = author;
      if (artist)   extraMerged.artist   = artist;
      if (location) extraMerged.location = location;
      if (rating)   extraMerged.rating   = rating;

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
