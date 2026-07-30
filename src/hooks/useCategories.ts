"use client";

import { useState, useEffect, useMemo } from "react";

const DEFAULT_ACTIVE_CATEGORIES = [
  "Productivity",
  "Self-improvement",
  "Business",
  "Health & fitness",
  "Content creation",
  "Psychology",
  "Technology",
  "Finance",
  "Entertainment",
];

function readStoredArray(key: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface UseCategoriesResult {
  customCategories: string[];
  setCustomCategories: React.Dispatch<React.SetStateAction<string[]>>;
  activeCategories: string[];
  setActiveCategories: React.Dispatch<React.SetStateAction<string[]>>;
  showAddCategory: boolean;
  setShowAddCategory: React.Dispatch<React.SetStateAction<boolean>>;
  hoveredCategory: string | null;
  setHoveredCategory: React.Dispatch<React.SetStateAction<string | null>>;
  newCategory: string;
  setNewCategory: React.Dispatch<React.SetStateAction<string>>;
  handleAddCategory: () => void;
  allCategories: string[];
}

export function useCategories(): UseCategoriesResult {
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    readStoredArray("discover_customCategories") ?? []
  );
  const [activeCategories, setActiveCategories] = useState<string[]>(
    () => {
      const stored = readStoredArray("discover_activeCategories");
      return stored && stored.length > 0 ? stored : DEFAULT_ACTIVE_CATEGORIES;
    }
  );
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("discover_activeCategories", JSON.stringify(activeCategories));
    }
  }, [activeCategories]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("discover_customCategories", JSON.stringify(customCategories));
    }
  }, [customCategories]);

  function handleAddCategory() {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!activeCategories.includes(trimmed) && !customCategories.includes(trimmed) && trimmed !== "All") {
      setCustomCategories((prev) => [...prev, trimmed]);
    }
    setNewCategory("");
    setShowAddCategory(false);
  }

  const allCategories = useMemo(
    () => ["All", ...activeCategories, ...customCategories],
    [activeCategories, customCategories]
  );

  return {
    customCategories,
    setCustomCategories,
    activeCategories,
    setActiveCategories,
    showAddCategory,
    setShowAddCategory,
    hoveredCategory,
    setHoveredCategory,
    newCategory,
    setNewCategory,
    handleAddCategory,
    allCategories,
  };
}
