/* ===== 记录类型 ===== */

export type RecordCategory = 'books' | 'movies' | 'notes' | 'albums' | 'travel' | 'concerts';

export type WeatherType = 'sunny' | 'rainy';
export type TimeOfDay = 'day' | 'night';

export interface BaseRecord {
  id: string;
  category: RecordCategory;
  createdAt: string;
  updatedAt: string;
}

export interface BookRecord extends BaseRecord {
  category: 'books';
  title: string;
  author: string;
  readDate: string;
  review: string;
  image?: string;
}

export interface MovieRecord extends BaseRecord {
  category: 'movies';
  title: string;
  watchDate: string;
  review: string;
  image?: string;
}

export interface NoteRecord extends BaseRecord {
  category: 'notes';
  title: string;
  date: string;
  content: string;
  tags: string[];
  image?: string;
}

export interface AlbumRecord extends BaseRecord {
  category: 'albums';
  title: string;
  artist: string;
  review: string;
  image?: string;
}

export interface TravelRecord extends BaseRecord {
  category: 'travel';
  title: string;
  location: string;
  date: string;
  review: string;
  image?: string;
}

export interface ConcertRecord extends BaseRecord {
  category: 'concerts';
  date: string;
  location: string;
  artist: string;
  review: string;
  image?: string;
}

export type AnyRecord =
  | BookRecord
  | MovieRecord
  | NoteRecord
  | AlbumRecord
  | TravelRecord
  | ConcertRecord;

/* ===== 分类定义 ===== */

export interface CategoryDef {
  key: RecordCategory;
  label: string;
  icon: string;
  hotspotLabel: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'image' | 'tags';
    placeholder?: string;
  }[];
  emptyHint: string;
}

export const categoryDefs: CategoryDef[] = [
  {
    key: 'books',
    label: '读书记录',
    icon: '📚',
    hotspotLabel: '书架',
    fields: [
      { name: 'title', label: '书名', type: 'text', placeholder: '输入书名' },
      { name: 'author', label: '作者', type: 'text', placeholder: '输入作者' },
      { name: 'readDate', label: '阅读时间', type: 'date' },
      { name: 'image', label: '书籍封面', type: 'image' },
      { name: 'review', label: '读后感', type: 'textarea', placeholder: '写下你的读后感...' },
    ],
    emptyHint: '还没有读书记录，点击添加第一本书吧',
  },
  {
    key: 'movies',
    label: '观影记录',
    icon: '🎬',
    hotspotLabel: '投影仪',
    fields: [
      { name: 'title', label: '电影名称', type: 'text', placeholder: '输入电影名' },
      { name: 'watchDate', label: '观看时间', type: 'date' },
      { name: 'image', label: '电影海报', type: 'image' },
      { name: 'review', label: '观后感', type: 'textarea', placeholder: '写下你的观后感...' },
    ],
    emptyHint: '还没有观影记录，点击添加第一部电影吧',
  },
  {
    key: 'notes',
    label: '写下的',
    icon: '📓',
    hotspotLabel: '笔记本',
    fields: [
      { name: 'title', label: '标题', type: 'text', placeholder: '输入标题' },
      { name: 'date', label: '日期', type: 'date' },
      { name: 'content', label: '正文', type: 'textarea', placeholder: '写下你想记录的内容...' },
      { name: 'image', label: '图片', type: 'image' },
      { name: 'tags', label: '标签（用逗号分隔）', type: 'tags', placeholder: '例如：灵感, 设计, 随笔' },
    ],
    emptyHint: '还没有笔记，点击写下第一条记录吧',
  },
  {
    key: 'albums',
    label: '专辑',
    icon: '💿',
    hotspotLabel: '专辑',
    fields: [
      { name: 'title', label: '专辑名称', type: 'text', placeholder: '输入专辑名' },
      { name: 'artist', label: '歌手/乐队', type: 'text', placeholder: '输入歌手名' },
      { name: 'image', label: '专辑封面', type: 'image' },
      { name: 'review', label: '我的感受', type: 'textarea', placeholder: '写下你对这张专辑的感受...' },
    ],
    emptyHint: '还没有专辑记录，点击添加第一张专辑吧',
  },
  {
    key: 'travel',
    label: '旅行',
    icon: '✈️',
    hotspotLabel: '旅行',
    fields: [
      { name: 'title', label: '旅行地点', type: 'text', placeholder: '输入旅行目的地' },
      { name: 'location', label: '具体地点', type: 'text', placeholder: '例如：京都 · 岚山' },
      { name: 'date', label: '旅行时间', type: 'date' },
      { name: 'image', label: '旅行照片', type: 'image' },
      { name: 'review', label: '旅行记忆', type: 'textarea', placeholder: '记录旅途中的故事...' },
    ],
    emptyHint: '还没有旅行记录，点击添加第一次旅行吧',
  },
  {
    key: 'concerts',
    label: '演唱会',
    icon: '🎫',
    hotspotLabel: '演唱会',
    fields: [
      { name: 'artist', label: '艺人/乐队', type: 'text', placeholder: '输入艺人名' },
      { name: 'date', label: '日期', type: 'date' },
      { name: 'location', label: '地点', type: 'text', placeholder: '输入演唱会地点' },
      { name: 'image', label: '现场照片', type: 'image' },
      { name: 'review', label: '我的感受', type: 'textarea', placeholder: '记录当时的感受...' },
    ],
    emptyHint: '还没有演唱会记录，点击添加第一场吧',
  },
];