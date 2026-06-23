import { StatCard } from "@/components/kit/stat-card";

export default function Page() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1E3A5F]">담당 현장 현황</h1>
        <p className="text-sm text-neutral-500">신규 제출과 생성 영상을 확인하세요.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard value={0} label="신규 제출" accent />
        <StatCard value={0} label="영상 완료" />
        <StatCard value={0} label="보완 요청" />
      </div>
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        담당 현장에 제출된 기록이 여기에 표시됩니다.
      </div>
    </div>
  );
}
