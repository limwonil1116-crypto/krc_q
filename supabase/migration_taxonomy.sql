-- 구조물 종류: 대분류 + 세부항목 체계로 교체
-- 주의: 기존 site_structures / construction_records / record_assets(테스트) 가 정리됩니다.

delete from site_structures;
delete from phase_templates;
delete from structure_types;
alter table structure_types add column if not exists parent_id uuid references structure_types(id);

-- 대분류
insert into structure_types (code, name, parent_id, sort_order) values
  ('FILLDAM','필댐',null,1),
  ('TUNNEL','터널',null,2),
  ('WEIR','취입보',null,3),
  ('PUMP','양배수장',null,4),
  ('CHANNEL','용배수로',null,5),
  ('PIPELINE','송수관로',null,6),
  ('LANDFILL','매립복토',null,7),
  ('LANDADJ','경지정리',null,8),
  ('FARMROAD','농도',null,9),
  ('CULVERT','암거배수공',null,10),
  ('SLUICEGATE','배수문',null,11)
on conflict (code) do nothing;

-- 세부항목
with cat as (select code, id from structure_types where parent_id is null)
insert into structure_types (code, name, parent_id, sort_order) values
  ('FILLDAM-1','가배수공',(select id from cat where code='FILLDAM'),1),
  ('FILLDAM-2','기초공사',(select id from cat where code='FILLDAM'),2),
  ('FILLDAM-3','축제공사',(select id from cat where code='FILLDAM'),3),
  ('FILLDAM-4','기타',(select id from cat where code='FILLDAM'),4),
  ('TUNNEL-1','굴착',(select id from cat where code='TUNNEL'),1),
  ('TUNNEL-2','지보재',(select id from cat where code='TUNNEL'),2),
  ('TUNNEL-3','기타',(select id from cat where code='TUNNEL'),3),
  ('WEIR-1','고정보',(select id from cat where code='WEIR'),1),
  ('WEIR-2','가동보',(select id from cat where code='WEIR'),2),
  ('PUMP-1','일반사항',(select id from cat where code='PUMP'),1),
  ('PUMP-2','기초공사',(select id from cat where code='PUMP'),2),
  ('PUMP-3','가설공사',(select id from cat where code='PUMP'),3),
  ('PUMP-4','토공사',(select id from cat where code='PUMP'),4),
  ('PUMP-5','철근 가공 및 조립',(select id from cat where code='PUMP'),5),
  ('PUMP-6','거푸집 및 동바리 조립',(select id from cat where code='PUMP'),6),
  ('PUMP-7','콘크리트 시공',(select id from cat where code='PUMP'),7),
  ('PUMP-8','물푸기',(select id from cat where code='PUMP'),8),
  ('PUMP-9','기타',(select id from cat where code='PUMP'),9),
  ('CHANNEL-1','일반사항',(select id from cat where code='CHANNEL'),1),
  ('CHANNEL-2','토공사',(select id from cat where code='CHANNEL'),2),
  ('CHANNEL-3','가설공사',(select id from cat where code='CHANNEL'),3),
  ('CHANNEL-4','기초공사',(select id from cat where code='CHANNEL'),4),
  ('CHANNEL-5','철근 가공 및 조립',(select id from cat where code='CHANNEL'),5),
  ('CHANNEL-6','거푸집 및 동바리 조립',(select id from cat where code='CHANNEL'),6),
  ('CHANNEL-7','콘크리트 시공',(select id from cat where code='CHANNEL'),7),
  ('CHANNEL-8','기성제품 운반 및 설치',(select id from cat where code='CHANNEL'),8),
  ('CHANNEL-9','기타',(select id from cat where code='CHANNEL'),9),
  ('PIPELINE-1','가설공사',(select id from cat where code='PIPELINE'),1),
  ('PIPELINE-2','토공사',(select id from cat where code='PIPELINE'),2),
  ('PIPELINE-3','기초공사',(select id from cat where code='PIPELINE'),3),
  ('PIPELINE-4','강관용접',(select id from cat where code='PIPELINE'),4),
  ('PIPELINE-5','PE관 융착',(select id from cat where code='PIPELINE'),5),
  ('PIPELINE-6','되메우기',(select id from cat where code='PIPELINE'),6),
  ('PIPELINE-7','다짐',(select id from cat where code='PIPELINE'),7),
  ('PIPELINE-8','포장',(select id from cat where code='PIPELINE'),8),
  ('PIPELINE-9','기타',(select id from cat where code='PIPELINE'),9),
  ('LANDFILL-1','일반사항',(select id from cat where code='LANDFILL'),1),
  ('LANDFILL-2','표토처리',(select id from cat where code='LANDFILL'),2),
  ('LANDFILL-3','복토재 상차 및 하차',(select id from cat where code='LANDFILL'),3),
  ('LANDFILL-4','답면 고르기',(select id from cat where code='LANDFILL'),4),
  ('LANDFILL-5','물지균',(select id from cat where code='LANDFILL'),5),
  ('LANDFILL-6','기타',(select id from cat where code='LANDFILL'),6),
  ('LANDADJ-1','일반사항',(select id from cat where code='LANDADJ'),1),
  ('LANDADJ-2','땅고르기',(select id from cat where code='LANDADJ'),2),
  ('LANDADJ-3','기타',(select id from cat where code='LANDADJ'),3),
  ('FARMROAD-1','일반사항',(select id from cat where code='FARMROAD'),1),
  ('FARMROAD-2','토공사',(select id from cat where code='FARMROAD'),2),
  ('FARMROAD-3','기초공사',(select id from cat where code='FARMROAD'),3),
  ('FARMROAD-4','포장',(select id from cat where code='FARMROAD'),4),
  ('FARMROAD-5','기타',(select id from cat where code='FARMROAD'),5),
  ('CULVERT-1','일반사항',(select id from cat where code='CULVERT'),1),
  ('CULVERT-2','토공사',(select id from cat where code='CULVERT'),2),
  ('CULVERT-3','기초공사',(select id from cat where code='CULVERT'),3),
  ('CULVERT-4','철근 가공 및 조립',(select id from cat where code='CULVERT'),4),
  ('CULVERT-5','동바리 및 거푸집 설치',(select id from cat where code='CULVERT'),5),
  ('CULVERT-6','콘크리트 시공',(select id from cat where code='CULVERT'),6),
  ('CULVERT-7','기타',(select id from cat where code='CULVERT'),7),
  ('SLUICEGATE-1','일반사항',(select id from cat where code='SLUICEGATE'),1),
  ('SLUICEGATE-2','토공사',(select id from cat where code='SLUICEGATE'),2),
  ('SLUICEGATE-3','가설공사',(select id from cat where code='SLUICEGATE'),3),
  ('SLUICEGATE-4','기초공사',(select id from cat where code='SLUICEGATE'),4),
  ('SLUICEGATE-5','철근 가공 및 조립',(select id from cat where code='SLUICEGATE'),5),
  ('SLUICEGATE-6','동바리 및 거푸집 설치',(select id from cat where code='SLUICEGATE'),6),
  ('SLUICEGATE-7','콘크리트 시공',(select id from cat where code='SLUICEGATE'),7),
  ('SLUICEGATE-8','기타',(select id from cat where code='SLUICEGATE'),8)
on conflict (code) do nothing;

-- VIDEO FRAME 5단계: 세부항목(말단)에만 부여
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
where st.is_active = true and st.parent_id is not null
on conflict (structure_type_id, code) do nothing;