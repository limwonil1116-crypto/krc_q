import { SiteForm } from "@/components/site/site-form";

export const dynamic = "force-dynamic";

export default async function NewClientSitePage() {
  return <SiteForm clientOrgs={[]} mode="client" />;
}
