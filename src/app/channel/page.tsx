"use client";

import { Suspense } from "react";
import { ChannelAnalytics } from "@/components/channel/ChannelAnalytics";

export default function ChannelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-white rounded-full" /></div>}>
      <ChannelAnalytics />
    </Suspense>
  );
}
