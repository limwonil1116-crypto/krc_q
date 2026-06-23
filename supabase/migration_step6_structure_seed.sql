-- STEP 4: 구조물 종류 예시 시드 (실제 첨부1 목록 확정 시 교체)
-- 이미 있는 RC(철근콘크리트)는 건드리지 않음. 나머지는 phase_templates 가 아직 없어
-- 구조물 "선택"에는 사용 가능하나, 단계별 기록(STEP 5)은 RC 기준입니다.
insert into structure_types (code, name, description, sort_order) values
  ('LEVEE',  '제방/둑',     '제방·둑 구조물',        2),
  ('SLUICE', '수문/통문',   '수문·통문 구조물',      3),
  ('DRAIN',  '배수로/용수로','배수로·용수로 구조물',  4),
  ('BRIDGE', '교량',        '교량 구조물',            5),
  ('RETWALL','옹벽',        '옹벽 구조물',            6),
  ('PAVE',   '포장',        '도로·포장',              7),
  ('PIPE',   '관로',        '관로 구조물',            8),
  ('ETC',    '기타',        '기타 구조물',            99)
on conflict (code) do nothing;
