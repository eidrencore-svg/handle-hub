import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { BulkClient } from "@/components/tools/BulkClient";
import { getViewer } from "@/lib/tools/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk check · Handle Hub" };

export default async function BulkPage() {
  const viewer = await getViewer();
  return (
    <PageShell width="max-w-4xl" plan={viewer.plan ?? undefined}>
      <ToolHeader title="Bulk check" line="Paste a list and check every name in one go." pro />
      <BulkClient viewer={viewer} />
    </PageShell>
  );
}
