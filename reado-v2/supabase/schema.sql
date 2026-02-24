create table if not exists public.content_pages (
  id bigserial primary key,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  body text not null default '',
  locale text not null default 'zh-CN',
  status text not null default 'draft' check (status in ('draft', 'published')),
  kind text not null default 'experience',
  source_group text not null default '',
  source_path text not null default '',
  order_index integer not null default 0,
  cover_url text not null default '',
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_pages add column if not exists kind text not null default 'experience';
alter table public.content_pages add column if not exists source_group text not null default '';
alter table public.content_pages add column if not exists source_path text not null default '';
alter table public.content_pages add column if not exists order_index integer not null default 0;
alter table public.content_pages add column if not exists cover_url text not null default '';
alter table public.content_pages add column if not exists tags text[] not null default '{}';
alter table public.content_pages add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists content_pages_status_updated_idx
  on public.content_pages (status, updated_at desc);
create index if not exists content_pages_group_updated_idx
  on public.content_pages (source_group, updated_at desc);
create index if not exists content_pages_tags_idx
  on public.content_pages using gin (tags);

create or replace function public.set_content_pages_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_content_pages_updated_at on public.content_pages;
create trigger trg_content_pages_updated_at
before update on public.content_pages
for each row execute procedure public.set_content_pages_updated_at();

alter table public.content_pages enable row level security;

drop policy if exists "published pages are public read" on public.content_pages;
create policy "published pages are public read"
  on public.content_pages
  for select
  using (status = 'published');

insert into public.content_pages (
  slug,
  title,
  summary,
  body,
  locale,
  status,
  kind,
  source_group,
  source_path,
  order_index,
  cover_url,
  tags,
  metadata
)
values (
  'hello-reado-v2',
  'Hello reado v2',
  '这是数据库驱动页面的第一条示例内容。',
  '这条内容来自 Supabase 表 content_pages。\n\n你现在访问 /p/hello-reado-v2 就会看到这段文本。',
  'zh-CN',
  'published',
  'experience',
  'demo',
  'seed/hello-reado-v2',
  1,
  '',
  array['demo', 'hello'],
  '{"seed":true}'::jsonb
)
on conflict (slug) do nothing;
