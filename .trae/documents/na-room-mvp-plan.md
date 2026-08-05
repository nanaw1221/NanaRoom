# NA 互动房间探索网站 MVP 实施计划

## Context

从零搭建一个基于 React + Vite + Tailwind CSS + Framer Motion 的二维互动房间探索网站。用户通过点击房间中的热点区域（沙发、书桌、床、书架、墙饰、窗户）来探索内容卡片，实现"探索一个房间"的浏览体验。

## 技术栈

- React 18 + TypeScript
- Vite 构建工具
- Tailwind CSS v3 样式
- Framer Motion 动画
- SVG 自绘制房间插图（零外部图片依赖）

## 文件结构

```
d:\vb\NA\NA\
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json / tsconfig.node.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   └── hotspot.ts              # 类型定义
│   ├── data/
│   │   └── hotspots.ts             # 6个热点数据
│   ├── hooks/
│   │   └── useHotspotInteraction.ts
│   └── components/
│       ├── Header.tsx
│       ├── RoomScene.tsx           # 场景容器（SVG + 热点 overlay）
│       ├── RoomSVG.tsx             # 纯 SVG 房间插图（~200行）
│       ├── Hotspot.tsx             # 单个可点击热点
│       ├── HotspotTooltip.tsx      # 悬停提示标签
│       ├── ContentCard.tsx         # 模态内容卡片
│       └── CardOverlay.tsx         # 半透明遮罩
```

## 组件树与数据流

```
App (useHotspotInteraction hook: selectedHotspot, hoveredHotspot)
├── Header
├── RoomScene (接收 hotspots + 交互回调)
│   ├── RoomSVG (纯 SVG 插图，viewBox="0 0 1000 700")
│   └── Hotspot[] (绝对定位，百分比坐标)
│       └── HotspotTooltip (hover 时显示)
└── AnimatePresence
    ├── CardOverlay (点击关闭)
    └── ContentCard (展示标题/图标/描述/标签)
```

- 所有状态集中在 `useHotspotInteraction` hook 中
- 热点数据在 `hotspots.ts` 中独立定义，添加新热点只需追加数据
- 热点坐标基于 viewBox 1000×700，通过百分比转换适配不同屏幕

## 动画方案

| 阶段 | 动画 | 实现 |
|------|------|------|
| 页面加载 | 6个热点依次弹入 | staggerChildren, spring |
| 悬停 | 脉冲点放大 + 边框显现 | spring(400,10) |
| 点击打开 | 遮罩淡入 + 卡片弹入 | spring(300,24) |
| 关闭 | 卡片缩小 + 遮罩淡出 | easeIn, 200ms |

## 响应式策略

- SVG 容器使用 `aspect-ratio` 保持比例，`max-width` 限制最大宽度
- 热点使用百分比定位自动适配
- ContentCard 移动端 `w-[90vw]`，桌面端 `max-w-[520px]`

## 实施步骤

1. 初始化 Vite React-TS 项目，安装 Tailwind + Framer Motion
2. 配置 Tailwind、全局样式、Google Fonts
3. 创建类型定义 `hotspot.ts`
4. 创建热点数据 `hotspots.ts`（6个热点）
5. 绘制 SVG 房间插图 `RoomSVG.tsx`
6. 实现交互组件：Hotspot、HotspotTooltip、ContentCard、CardOverlay
7. 实现状态管理 hook、Header、RoomScene
8. 组装 App.tsx 和 main.tsx
9. `npm run build` 构建验证
10. `npm run preview` 预览效果

## 验证清单

- [ ] `npm run build` 零错误
- [ ] 页面加载热点依次弹入动画
- [ ] 悬停热点有视觉反馈 + 标签
- [ ] 点击打开内容卡片，动画流畅
- [ ] 关闭卡片（遮罩/按钮）动画正常
- [ ] 375px / 768px / 1440px 宽度下布局正常