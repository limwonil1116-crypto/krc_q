-- 검측내용 / 검측부위 컬럼 추가 (construction_records)
ALTER TABLE construction_records
  ADD COLUMN IF NOT EXISTS inspection_content text,
  ADD COLUMN IF NOT EXISTS inspection_part_from_main integer,
  ADD COLUMN IF NOT EXISTS inspection_part_from_sub integer,
  ADD COLUMN IF NOT EXISTS inspection_part_to_main integer,
  ADD COLUMN IF NOT EXISTS inspection_part_to_sub integer;
