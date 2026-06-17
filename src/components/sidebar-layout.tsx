"use client";

import { useState } from "react";
import { KeywordSidebar } from "@/components/keyword-sidebar";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex flex-1">
      <KeywordSidebar onCollapseChange={setSidebarCollapsed} />
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-12" : "ml-72"}`}>
        {children}
      </main>
    </div>
  );
}
