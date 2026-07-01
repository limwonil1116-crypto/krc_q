-- [가이드 F1~F5 전환] guide_assets 를 phase_template 에 연결
alter table guide_assets
  add column if not exists phase_template_id uuid references phase_templates(id) on delete cascade;

-- structure_type_id 는 이제 선택적(단계 기반으로 전환)
alter table guide_assets
  alter column structure_type_id drop not null;

create index if not exists guide_assets_phase_idx on guide_assets(phase_template_id);
