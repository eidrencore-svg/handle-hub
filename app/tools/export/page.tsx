import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { ExportClient } from "@/components/tools/ExportClient";
import { Gate } from "@/components/tools/Gate";
import { getViewer } from "@/lib/tools/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "CSV export · Handle Hub" };

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ username?: string }> }) {
  const [{ username }, viewer] = await Promise.all([searchParams, getViewer()]);
  return (
    <PageShell width="max-w-3xl" plan={viewer.plan ?? undefined}>
      <ToolHeader title="CSV export" line="Download any scan for your team or your records." pro />
      <div className="mt-6">
        {!viewer.signedIn ? (
          <Gate kind="login" feature="CSV export" next="/tools/export" />
        ) : !viewer.limits.csvExport ? (
          <Gate kind="pro" feature="CSV export" />
        ) : null}
      </div>
      <ExportClient initial={username?.slice(0, 32)} allowed={viewer.limits.csvExport} />
    </PageShell>
  );
}
