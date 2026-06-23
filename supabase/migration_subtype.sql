-- 등록 모델 변경: 구조물=대분류 등록, 세부항목은 기록 화면에서 선택
-- 주의: 기존 site_structures/construction_records/record_assets(테스트) 정리됨

alter table construction_records add column if not exists sub_type_id uuid references structure_types(id);

delete from site_structures;   -- 대분류 등록 모델로 전환(첨부/기록 cascade 정리)
delete from phase_templates;

-- VIDEO FRAME 5단계: 대분류(부모)에 부여 (세부항목은 기록 시 선택)
insert into phase_templates
  (structure_type_id, code, name, sort_order, min_photo_count, min_video_count, text_required, guide_text)
select st.id, v.code, v.name, v.sort_order, v.minp, v.minv, true, v.guide
from structure_types st
cross join (values
  ('F1','공종 종류',1,1,0,'공사명·위치·공종·검측 부위·검측 내용·검측 일자를 표시합니다. 현장 표지판 등 사진 1장 이상.'),
  ('F2','설계도면 표시',2,1,0,'촬영 부위 이해를 위한 평면도·배근도(또는 관련 도면)를 첨부합니다.'),
  ('F3','검측 내용 상세 설명',3,1,0,'검측 내용 상세 설명. (예: 철근 배근 상세, 보드판 표 또는 일람 도면 첨부)'),
  ('F4','세부 촬영',4,4,0,'세부 촬영. 규격·간격·상태 등을 줄자 눈금이 보이게 근접 촬영합니다.'),
  ('F5','전체 촬영',5,0,1,'전체 촬영. 스타프를 따라 종·횡방향으로 천천히 촬영합니다.')
) as v(code,name,sort_order,minp,minv,guide)
where st.is_active = true and st.parent_id is null
on conflict (structure_type_id, code) do nothing;
