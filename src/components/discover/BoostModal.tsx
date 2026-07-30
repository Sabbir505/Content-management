"use client";

import type { BoostItem } from "./VideoCardMenus";

interface BoostModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BoostItem[];
}

export function BoostModal({ isOpen, onClose, items }: BoostModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <h3 className="text-lg font-semibold text-white">Boost</h3>
        </div>

        {/* Boost Options */}
        <div className="p-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[#2a2a2a] transition-colors text-left"
            >
              <span className="text-[#888] mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-[#888]">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
