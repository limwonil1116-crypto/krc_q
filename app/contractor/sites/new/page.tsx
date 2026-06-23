import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { SiteForm } from "@/components/site/site-form";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const clientOrgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(and(eq(organizations.type, "client_agency"), eq(organizations.status, "active")));

  return <SiteForm clientOrgs={clientOrgs} />;
}
