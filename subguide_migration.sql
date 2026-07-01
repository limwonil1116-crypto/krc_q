-- [세부항목별 가이드] 세부항목(subType) x 단계(F1~F5) 가이드 텍스트
create table if not exists guide_entries (
  id uuid primary key default gen_random_uuid(),
  sub_type_id uuid not null references structure_types(id) on delete cascade,
  phase_code varchar(50) not null,
  guide_text text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (sub_type_id, phase_code)
);
create index if not exists guide_entries_sub_idx on guide_entries(sub_type_id);

-- guide_assets: 세부항목 자료를 위해 sub_type_id + phase_code 추가
alter table guide_assets
  add column if not exists sub_type_id uuid references structure_types(id) on delete cascade,
  add column if not exists phase_code varchar(50);
create index if not exists guide_assets_sub_idx on guide_assets(sub_type_id, phase_code);
