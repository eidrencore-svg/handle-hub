import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { GeneratedToolClient } from "@/components/tools/GeneratedToolClient";
import { getViewer } from "@/lib/tools/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Variant compare · Handle Hub" };

export default async function VariantsPage() {
  const viewer = await getViewer();
  return (
    <PageShell width="max-w-4xl" plan={viewer.plan ?? undefined}>
      <ToolHeader title="Variant compare" line="See name, name_, name. and name1 side by side." pro />
      <GeneratedToolClient mode="variants" viewer={viewer} />
    </PageShell>
  );
}
