"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface KeywordItem {
  id: string;
  keyword: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
}

interface UseKeywordsResult {
  keywords: KeywordItem[];
  isLoading: boolean;
  addKeyword: (keyword: string) => Promise<void>;
  deleteKeyword: (id: string) => Promise<void>;
}

export function useKeywords(userId: string | undefined): UseKeywordsResult {
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const q = query(
      collection(db, "users", userId, "keywords"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        })) as KeywordItem[];
        setKeywords(items);
        setIsLoading(false);
      },
      (error) => {
        console.error("[useKeywords] Failed to load keywords:", error);
        setIsLoading(false);
        toast.error(
          error.message?.includes("index")
            ? "Database index is being created. Keywords will load shortly."
            : "Failed to load keywords. Please try again."
        );
      }
    );

    return () => unsubscribe();
  }, [userId]);

  async function addKeyword(keyword: string): Promise<void> {
    if (!userId || !keyword.trim()) return;
    try {
      await addDoc(collection(db, "users", userId, "keywords"), {
        keyword: keyword.trim(),
        createdAt: serverTimestamp(),
      });
      toast.success("Keyword added");
    } catch {
      toast.error("Failed to add keyword");
    }
  }

  async function deleteKeyword(id: string): Promise<void> {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "keywords", id));
      toast.success("Keyword removed");
    } catch {
      toast.error("Failed to remove keyword");
    }
  }

  return { keywords, isLoading: isLoading && !!userId, addKeyword, deleteKeyword };
}
