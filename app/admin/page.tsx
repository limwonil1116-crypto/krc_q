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
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="/admin/guides" className="rounded-2xl border border-neutral-200 bg-white p-5 hover:border-[#0033A0] hover:shadow">
          <div className="text-lg font-bold text-[#0033A0]">🤖 검측 가이드 관리</div>
          <p className="mt-1 text-sm text-neutral-500">구조물·세부유형별 단계 가이드를 작성합니다. AI 기록 작성에 반영됩니다.</p>
        </a>
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-center text-sm text-neutral-400">
          구조물 마스터·사용자 승인 기능은 다음 단계에서 추가됩니다.
        </div>
      </div>
    </div>
  );
}
