-- #6 현장 등록폼 확장: 공종 다중선택 + 현장소장 정보
ALTER TABLE construction_sites
  ADD COLUMN IF NOT EXISTS work_types text,
  ADD COLUMN IF NOT EXISTS site_manager_name varchar(80),
  ADD COLUMN IF NOT EXISTS site_manager_phone varchar(30),
  ADD COLUMN IF NOT EXISTS site_manager_email varchar(255);
