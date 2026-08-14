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

export function useCategoryIntros() {
  const { isConfigured, isAdmin, isLoading } = useAuth();

  const [intros, setIntros] = useState<IntroMap>(() => loadLocal());
  const [cloudSynced, setCloudSynced] = useState(false);

  const fetchReqIdRef = useRef(0);
  const hasFetchedCloudRef = useRef(false);

  useEffect(() => {
    if (!isConfigured || !supabase) return;
    if (isLoading) return;
    if (hasFetchedCloudRef.current) return;
    hasFetchedCloudRef.current = true;

    const reqId = ++fetchReqIdRef.current;

    const fetchCloud = async () => {
      try {
        const { data, error } = await supabase!
          .from('category_intros')
          .select('category, text');

        if (fetchReqIdRef.current !== reqId) return;

        if (error) {
          console.warn('[useCategoryIntros] 云端拉取失败:', error.message);
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
      } catch (e: any) {
        console.warn('[useCategoryIntros] 云端拉取异常:', e?.message);
      } finally {
        if (fetchReqIdRef.current === reqId) {
          setCloudSynced(true);
        }
      }
    };

    fetchCloud();
  }, [isConfigured, isLoading]);

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
