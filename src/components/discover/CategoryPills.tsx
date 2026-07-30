"use client";

import { Trash2 } from "lucide-react";

interface CategoryPillsProps {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  hoveredCategory: string | null;
  onHover: (category: string | null) => void;
  onRemove: (category: string) => void;
  showAdd: boolean;
  onShowAdd: () => void;
  onCancelAdd: () => void;
  newCategory: string;
  onNewCategoryChange: (value: string) => void;
  onAddCategory: () => void;
}

export function CategoryPills({
  categories,
  selectedCategory,
  onSelect,
  hoveredCategory,
  onHover,
  onRemove,
  showAdd,
  onShowAdd,
  onCancelAdd,
  newCategory,
  onNewCategoryChange,
  onAddCategory,
}: CategoryPillsProps) {
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          onMouseEnter={() => onHover(category)}
          onMouseLeave={() => onHover(null)}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === category
              ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
              : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-white"
          }`}
        >
          {category === "All" ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              All
            </>
          ) : (
            <>
              {category}
              {hoveredCategory === category && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(category);
                  }}
                  className="ml-1 flex items-center justify-center text-[#555] hover:text-red-400 transition-colors cursor-pointer"
                  title="Remove category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              )}
            </>
          )}
        </button>
      ))}
      {/* Add Category Button */}
      {showAdd ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => onNewCategoryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAddCategory();
              if (e.key === "Escape") onCancelAdd();
            }}
            placeholder="New category..."
            autoFocus
            className="px-3 py-1.5 rounded-full text-sm bg-[#1a1a1a] border border-[#3a3a3a] text-white placeholder-[#666] focus:outline-none focus:border-[#4a4a4a] transition-colors w-32"
          />
          <button
            onClick={onAddCategory}
            className="p-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={onCancelAdd}
            className="p-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={onShowAdd}
          className="px-4 py-1.5 rounded-full text-sm border border-dashed border-[#3a3a3a] text-[#888] hover:text-white hover:border-[#4a4a4a] transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      )}
    </div>
  );
}
