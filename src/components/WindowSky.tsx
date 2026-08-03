import type { WeatherType } from '../types/records';
import type { TimePhase } from '../hooks/useWindowState';

interface WindowSkyProps {
  timePhase: TimePhase;
  weather: WeatherType;
}

// 根据时间+天气组合返回对应的背景图片 URL
export function getWindowImage(timePhase: TimePhase, weather: WeatherType): string | null {
  const isNight = timePhase === 'night';

  if (weather === 'sunny' && !isNight) {
    return null; // 晴天白天使用默认背景图
  }

  if (weather === 'sunny' && isNight) {
    return '/room-window-sunny-night.png';
  }

  if (weather === 'rainy' && !isNight) {
    return '/room-window-rainy-day.png';
  }

  if (weather === 'rainy' && isNight) {
    return '/room-window-rainy-night.png';
  }

  return null;
}

const WindowSky = ({ timePhase, weather }: WindowSkyProps) => {
  const imageUrl = getWindowImage(timePhase, weather);

  if (!imageUrl) return null;

  return (
    <img
      src={imageUrl}
      alt=""
      className="absolute inset-0 w-full h-full object-contain z-[2] rounded-[20px]"
      draggable={false}
    />
  );
};

export default WindowSky;
