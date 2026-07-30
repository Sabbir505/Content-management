"use client";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="text-center p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-[#888]">{label}</p>
      {sub && <p className="text-xs text-[#666] mt-0.5">{sub}</p>}
    </div>
  );
}
