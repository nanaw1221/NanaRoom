import { useState, useEffect, useCallback, useMemo } from 'react';
import type { WeatherType } from '../types/records';

const WEATHER_KEY = 'na_weather';

/**
 * 昼夜时段（更细粒度，用于光照变化）
 * - sunrise:  日出  05:00 - 07:00
 * - morning:  上午  07:00 - 11:00
 * - noon:     中午  11:00 - 14:00
 * - afternoon:下午  14:00 - 17:00
 * - sunset:   日落  17:00 - 19:30
 * - night:    夜晚  19:30 - 05:00
 */
export type TimePhase = 'sunrise' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'night';

/** 兼容旧接口：白天/夜晚两档 */
export type TimeOfDayCompat = 'day' | 'night';

function loadWeather(): WeatherType {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    if (raw === 'sunny' || raw === 'rainy') return raw;
  } catch { /* ignore */ }
  return 'sunny';
}

/** 取北京时间（UTC+8） */
function getBeijingNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + 8 * 60 * 60 * 1000);
}

/** 根据北京时间的小时+分钟，推断时段 */
function getTimePhase(d: Date): TimePhase {
  const m = d.getHours() * 60 + d.getMinutes();
  if (m < 5 * 60) return 'night';                       // 00:00 - 05:00
  if (m < 7 * 60) return 'sunrise';                     // 05:00 - 07:00
  if (m < 11 * 60) return 'morning';                    // 07:00 - 11:00
  if (m < 14 * 60) return 'noon';                       // 11:00 - 14:00
  if (m < 17 * 60) return 'afternoon';                  // 14:00 - 17:00
  if (m < 19 * 60 + 30) return 'sunset';                // 17:00 - 19:30
  return 'night';                                       // 19:30 - 24:00
}

function getTimeOfDayCompat(p: TimePhase): TimeOfDayCompat {
  return p === 'night' ? 'night' : 'day';
}

/** 格式化 HH:MM:SS */
function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** 格式化 YYYY-MM-DD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PHASE_LABEL: Record<TimePhase, string> = {
  sunrise: '🌅 日出',
  morning: '🌤️ 上午',
  noon: '☀️ 中午',
  afternoon: '🌞 下午',
  sunset: '🌇 日落',
  night: '🌙 夜晚',
};

export function useWindowState() {
  const [weather, setWeather] = useState<WeatherType>(loadWeather);
  const [now, setNow] = useState<Date>(() => getBeijingNow());

  // 每秒更新北京时间
  useEffect(() => {
    const tick = () => setNow(getBeijingNow());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // 天气持久化
  useEffect(() => {
    try { localStorage.setItem(WEATHER_KEY, weather); } catch { /* ignore */ }
  }, [weather]);

  const timePhase = useMemo(() => getTimePhase(now), [now]);
  const timeOfDay = useMemo(() => getTimeOfDayCompat(timePhase), [timePhase]);
  const timeString = useMemo(() => formatTime(now), [now]);
  const dateString = useMemo(() => formatDate(now), [now]);
  const isNight = timeOfDay === 'night';

  const toggleWeather = useCallback(() => {
    setWeather((prev) => (prev === 'sunny' ? 'rainy' : 'sunny'));
  }, []);

  const weatherLabel: Record<WeatherType, string> = {
    sunny: '☀️ 晴天',
    rainy: '🌧️ 雨天',
  };

  return {
    // 原始
    weather,
    timeOfDay,
    toggleWeather,
    weatherLabel,
    // 新增
    now,                        // 北京时间 Date 对象（给时钟指针用）
    timePhase,                  // 细粒度时段（给光照叠层用）
    phaseLabel: PHASE_LABEL[timePhase],
    timeString,                 // "HH:MM:SS"
    dateString,                 // "YYYY-MM-DD"
    isNight,
  };
}
