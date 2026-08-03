-- =================================================================
--  NanaRoom  ·  Supabase 一键初始化 SQL
--  用法：
--    1) 打开 https://supabase.com → 新建 Project → 进入项目
--    2) 左侧菜单 SQL Editor → New Query → 把整个文件粘贴进去 → Run
--    3) 找到下面两行的 YOUR_ADMIN_EMAIL@example.com
--       改成你注册/创建管理员时使用的真实邮箱，再 Run 一次
--    4) 去 Storage → Create bucket → 名: record-images, 勾 Make public
-- =================================================================

-- 1. 扩展
create extension if not exists "pgcrypto";

-- 2. records 表（如果不存在就建）
create table if not exists public.records (
  id          bigserial primary key,
  category    text not null,           -- notebook / books / films / albums / travel / concerts
  title       text,
  description text,
  image_url   text,
  rating      integer,
  date        text,
  tags        text[] default '{}',
  extra       jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists records_category_idx
  on public.records (category, created_at desc);

-- 3. 打开行级安全（RLS），默认全拒绝
alter table public.records enable row level security;

-- 4. 读策略：任何人（含匿名访客）都能读
drop policy if exists "Public can read records" on public.records;
create policy "Public can read records"
  on public.records for select using (true);

-- 5. 写策略：只有管理员邮箱 可以增/改/删
--    ⚠️ 把下面两个邮箱改成你真实的管理员邮箱后，再 Run 一次！
drop policy if exists "Admin can write records" on public.records;
create policy "Admin can write records"
  on public.records for all
  using     (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL@example.com')
  with check (auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL@example.com');

-- =================================================================
--  Storage 桶（运行完上面后，请在控制台手动建桶，然后执行下面这 3 句）
--    Storage → Create bucket
--      Name: record-images
--      Make public: ✅ 打勾
--      File size limit: 5 MB (建议)
-- =================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'record-images',
  'record-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/bmp']
)
on conflict (id) do nothing;

-- Storage 读：匿名公开可读
drop policy if exists "Public read record-images" on storage.objects;
create policy "Public read record-images"
  on storage.objects for select
  using (bucket_id = 'record-images');

-- Storage 写：只有管理员邮箱 可以上传 / 删除
drop policy if exists "Admin write record-images" on storage.objects;
create policy "Admin write record-images"
  on storage.objects for all
  with check (
    bucket_id = 'record-images' and
    auth.jwt() ->> 'email' = 'YOUR_ADMIN_EMAIL@example.com'
  );
