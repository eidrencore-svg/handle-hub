import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { DomainsClient } from "@/components/tools/DomainsClient";

export const metadata: Metadata = { title: "Domain check · Handle Hub" };

export default async function DomainsPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  return (
    <PageShell width="max-w-4xl">
      <ToolHeader title="Domain check" line="See whether .com, .io, .dev and more match your handle." />
      <DomainsClient initial={name?.slice(0, 63)} />
    </PageShell>
  );
}
