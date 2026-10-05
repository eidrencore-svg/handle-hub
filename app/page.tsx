import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";

function HomeFallback() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 text-slate-300">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/70 px-5 py-3 text-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        Loading Handle Hub…
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeClient />
    </Suspense>
  );
}
