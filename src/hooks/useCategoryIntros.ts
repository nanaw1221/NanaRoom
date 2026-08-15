// ============================================================
// useCategoryIntros · 分类介绍文字管理
// 与 useRecords 保持相同的设计原则：
//   1. localStorage 是真相源 —— 立即读写
//   2. Supabase 是同步层 —— 后台拉取/推送
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { RecordCategory } from '../types/records';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const STORAGE_PREFIX = 'na2_';
const STORAGE_KEY = `${STORAGE_PREFIX}category_intros`;

type IntroMap = Record<RecordCategory, string>;

const DEFAULT_INTROS: IntroMap = {
  books: '',
  movies: '',
  notes: '',
  albums: '',
  travel: '',
  concerts: '',
};

function loadLocal(): IntroMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_INTROS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_INTROS };
}

function saveLocal(intros: IntroMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(intros));
  } catch (e) {
    console.error('[useCategoryIntros] saveLocal 写入失败:', e);
  }
}

// 判断错误是否为"表不存在"（schema cache 问题）
function isTableMissingError(message: string): boolean {
  return message?.includes('Could not find the table') || message?.includes('schema cache');
}

export function useCategoryIntros() {
  const { isConfigured, isAdmin, isLoading } = useAuth();

  const [intros, setIntros] = useState<IntroMap>(() => loadLocal());
  const [cloudSynced, setCloudSynced] = useState(false);

  const fetchReqIdRef = useRef(0);
  const hasFetchedCloudRef = useRef(false);
  const fetchFailCountRef = useRef(0);

  const fetchCloud = useCallback(async () => {
    if (!isConfigured || !supabase) return;
    if (isLoading) return;
    if (hasFetchedCloudRef.current) return;

    const reqId = ++fetchReqIdRef.current;

    try {
      const { data, error } = await supabase!
        .from('category_intros')
        .select('category, text');

      if (fetchReqIdRef.current !== reqId) return;

      if (error) {
        console.warn('[useCategoryIntros] 云端拉取失败:', error.message);
        // 如果是表不存在的错误，允许重试（最多重试 5 次）
        if (isTableMissingError(error.message) && fetchFailCountRef.current < 5) {
          fetchFailCountRef.current++;
          console.warn(`[useCategoryIntros] 表可能不存在，将在稍后重试 (${fetchFailCountRef.current}/5)`);
          return; // 不设置 hasFetchedCloudRef，允许重试
        }
        hasFetchedCloudRef.current = true;
        setCloudSynced(true);
        return;
      }

      if (data && data.length > 0) {
        setIntros((prev) => {
          const next = { ...prev };
          for (const row of data) {
            const cat = row.category as RecordCategory;
            if (cat && row.text) {
              next[cat] = row.text;
            }
          }
          saveLocal(next);
          return next;
        });
      }
      console.log('[useCategoryIntros] 云端介绍拉取成功');
      hasFetchedCloudRef.current = true;
      setCloudSynced(true);
    } catch (e: any) {
      if (fetchReqIdRef.current !== reqId) return;
      console.warn('[useCategoryIntros] 云端拉取异常:', e?.message);
      hasFetchedCloudRef.current = true;
      setCloudSynced(true);
    }
  }, [isConfigured, isLoading]);

  // 初始拉取
  useEffect(() => {
    if (!isConfigured || !supabase) return;
    if (isLoading) return;
    fetchCloud();
  }, [isConfigured, isLoading, fetchCloud]);

  // 表不存在时，延迟重试
  useEffect(() => {
    if (!isConfigured || !supabase) return;
    if (isLoading) return;
    if (hasFetchedCloudRef.current) return;

    const timer = setInterval(() => {
      if (hasFetchedCloudRef.current) {
        clearInterval(timer);
        return;
      }
      fetchCloud();
    }, 3000); // 每 3 秒重试一次

    return () => clearInterval(timer);
  }, [isConfigured, isLoading, fetchCloud]);

  const getIntro = useCallback(
    (category: RecordCategory): string => {
      return intros[category] ?? '';
    },
    [intros],
  );

  const saveIntro = useCallback(
    async (category: RecordCategory, text: string) => {
      // 1. 立即写本地
      setIntros((prev) => {
        const next = { ...prev, [category]: text };
        saveLocal(next);
        return next;
      });

      // 2. 云端写入（仅管理员）
      if (isConfigured && isAdmin && supabase) {
        try {
          const { data: existing } = await supabase!
            .from('category_intros')
            .select('id')
            .eq('category', category)
            .maybeSingle();

          if (existing) {
            await supabase!
              .from('category_intros')
              .update({ text, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase!
              .from('category_intros')
              .insert({ category, text, updated_at: new Date().toISOString() });
          }
          console.log(`[useCategoryIntros] 云端保存成功: ${category}`);
        } catch (e: any) {
          console.warn(`[useCategoryIntros] 云端保存失败 (${category}):`, e?.message);
          // 如果表不存在，标记需要重新拉取
          if (isTableMissingError(e?.message)) {
            hasFetchedCloudRef.current = false;
          }
        }
      }
    },
    [isConfigured, isAdmin],
  );

  return {
    intros,
    getIntro,
    saveIntro,
    cloudSynced,
  };
}
