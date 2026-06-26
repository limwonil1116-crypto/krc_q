// 한국농어촌공사 지사 목록 + 순수 권한 헬퍼 (DB 의존 없음 → 클라이언트 import 안전)
export const KRC_BRANCHES = [
  "본부내근",
  "천안",
  "공주",
  "보령",
  "아산",
  "서산태안",
  "논산",
  "세종대전금산",
  "부여",
  "서천",
  "청양",
  "홍성",
  "예산",
  "당진",
] as const;

export type Branch = (typeof KRC_BRANCHES)[number];

export function branchLabel(branch: string | null | undefined): string {
  if (!branch) return "-";
  return branch === "본부내근" ? "충남본부 내근" : `${branch}지사`;
}

// 본부내근 = 전체 권한
export function isHeadOffice(branch: string | null | undefined): boolean {
  return branch === "본부내근";
}

// 현장(executor)이 사용자의 권한 범위에 들어오는지
export function canAccessSiteByBranch(
  branch: string | null | undefined,
  executor: string | null | undefined
): boolean {
  if (isHeadOffice(branch)) return true;
  if (!branch) return false;
  return (executor ?? "") === branch;
}
