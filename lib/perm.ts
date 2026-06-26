import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// 한국농어촌공사 지사 목록 (가입/현장등록 공용)
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

// 본부내근 = 전체 권한
export function isHeadOffice(branch: string | null | undefined): boolean {
  return branch === "본부내근";
}

// 사용자의 소속 지사 조회
export async function getMyBranch(userId: string): Promise<string | null> {
  const rows = await db.select({ branch: users.branch }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.branch ?? null;
}

// 현장(executor)이 사용자의 권한 범위에 들어오는지
// 본부내근: 전체 true / 그 외: executor === branch
export function canAccessSiteByBranch(branch: string | null | undefined, executor: string | null | undefined): boolean {
  if (isHeadOffice(branch)) return true;
  if (!branch) return false;
  return (executor ?? "") === branch;
}
