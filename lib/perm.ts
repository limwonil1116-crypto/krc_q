import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export { KRC_BRANCHES, isHeadOffice, canAccessSiteByBranch, branchLabel } from "@/lib/branches";
export type { Branch } from "@/lib/branches";

// 사용자의 소속 지사 조회 (서버 전용)
export async function getMyBranch(userId: string): Promise<string | null> {
  const rows = await db.select({ branch: users.branch }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.branch ?? null;
}
