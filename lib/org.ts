import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationMembers, organizations } from "@/lib/db/schema";

// 로그인한 사용자의 소속 조직 id (역할 무관)
export async function getMyOrgId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

// 시공사 조직 id (기존 호환)
export async function getContractorOrgId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: organizations.id })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizations.type, "contractor")))
    .limit(1);
  return rows[0]?.orgId ?? null;
}
