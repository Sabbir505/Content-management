"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, isOpen, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") onClose();
      });
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate position to keep menu within viewport
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 240),
    top: Math.min(position.y, window.innerHeight - 200),
    zIndex: 9999,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="min-w-[220px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-[#2a2a2a] ${
            item.danger ? "text-red-400" : "text-white"
          }`}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
          <span className="flex-1 text-left">{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-[#666] ml-2">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Hook for managing context menu
export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  return { isOpen, position, openMenu, closeMenu };
}
