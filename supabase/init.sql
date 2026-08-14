-- =================================================================
--  NanaRoom  ·  Supabase 一键初始化 SQL（v2 · 2026-08-05 重写）
--  用法：
--    1) 打开 https://supabase.com → 进入项目
--    2) 左侧菜单 SQL Editor → New Query → 把整个文件粘贴进去 → Run
--    3) 全部语句幂等，可重复运行；下面已写死管理员邮箱
--       lilisnuonuo@gmail.com，如需修改直接改下面两行
-- =================================================================

-- 管理员邮箱：lilisnuonuo@gmail.com（已写死，换邮箱时全文搜索替换即可）

-- 1. 扩展
create extension if not exists "pgcrypto";

-- 2. records 表
create table if not exists public.records (
  id          bigserial primary key,
  category    text not null,
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

-- 3. 打开行级安全（RLS）
alter table public.records enable row level security;

-- 4. 读策略：任何人（含匿名访客）都能读
drop policy if exists "Public can read records" on public.records;
create policy "Public can read records"
  on public.records for select using (true);

-- 5. 写策略：只有管理员邮箱可以增/改/删
drop policy if exists "Admin can write records" on public.records;
create policy "Admin can write records"
  on public.records for all
  using     (auth.jwt() ->> 'email' = 'lilisnuonuo@gmail.com')
  with check (auth.jwt() ->> 'email' = 'lilisnuonuo@gmail.com');

-- =================================================================
--  category_intros 表（热点区域介绍文字）
-- =================================================================
-- 6. 创建 category_intros 表
create table if not exists public.category_intros (
  id          bigserial primary key,
  category    text not null unique,
  text        text default '',
  updated_at  timestamptz not null default now()
);

-- 7. 打开行级安全（RLS）
alter table public.category_intros enable row level security;

-- 8. 读策略：任何人（含匿名访客）都能读
drop policy if exists "Public can read category_intros" on public.category_intros;
create policy "Public can read category_intros"
  on public.category_intros for select using (true);

-- 9. 写策略：只有管理员邮箱可以增/改/删
drop policy if exists "Admin can write category_intros" on public.category_intros;
create policy "Admin can write category_intros"
  on public.category_intros for all
  using     (auth.jwt() ->> 'email' = 'lilisnuonuo@gmail.com')
  with check (auth.jwt() ->> 'email' = 'lilisnuonuo@gmail.com');

-- =================================================================
--  Storage 桶（存上传的图片）
-- =================================================================
-- 10. 创建 record-images 桶（公开可读，5MB 限制）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'record-images',
  'record-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/bmp']
)
on conflict (id) do nothing;

-- 11. Storage 读：匿名公开可读
drop policy if exists "Public read record-images" on storage.objects;
create policy "Public read record-images"
  on storage.objects for select
  using (bucket_id = 'record-images');

-- 12. Storage 写：只有管理员邮箱可以上传/删除
drop policy if exists "Admin write record-images" on storage.objects;
create policy "Admin write record-images"
  on storage.objects for all
  using (
    bucket_id = 'record-images' and
    auth.jwt() ->> 'email' = 'lilisnuonuo@gmail.com'
  )
  with check (
    bucket_id = 'record-images' and
    auth.jwt() ->> 'email' = 'lilisnuonuo@gmail.com'
  );

-- =================================================================
--  清空旧数据（如果之前有 base64 图片的脏数据，这里一键清空）
--  ⚠️ 这会删除 records 表所有数据！如果不想删除，注释掉下面这行
-- =================================================================
truncate table public.records restart identity;

-- =================================================================
--  验证（运行后应该在结果里看到 bucket 存在 + 策略正确）
-- =================================================================
select 'bucket' as type, id as name, public as is_public
from storage.buckets where id = 'record-images';

select 'policy' as type, policyname, cmd
from pg_policies
where tablename in ('records', 'category_intros', 'objects')
order by tablename, policyname;
