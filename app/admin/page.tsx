import { StatCard } from "@/components/kit/stat-card";

export default function Page() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0033A0]">관리자 콘솔</h1>
        <p className="text-sm text-neutral-500">승인·마스터·생성 상태를 관리합니다.</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <StatCard value={0} label="승인 대기" accent />
        <StatCard value={0} label="전체 현장" />
        <StatCard value={0} label="영상 생성" />
        <StatCard value={0} label="메일 발송" />
      </div>
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        구조물 마스터·단계 템플릿·사용자 승인 기능은 다음 단계에서 추가됩니다.
      </div>
    </div>
  );
}
