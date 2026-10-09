import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { GeneratedToolClient } from "@/components/tools/GeneratedToolClient";
import { getViewer } from "@/lib/tools/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suggestions · Handle Hub" };

export default async function SuggestionsPage() {
  const viewer = await getViewer();
  return (
    <PageShell width="max-w-4xl" plan={viewer.plan ?? undefined}>
      <ToolHeader title="Suggestions" line="Taken? Get close alternatives that are actually free." pro />
      <GeneratedToolClient mode="suggestions" viewer={viewer} />
    </PageShell>
  );
}
