"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface KeywordItem {
  id: string;
  keyword: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
}

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "keywords"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      })) as KeywordItem[];
      setKeywords(items);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim() || !user) return;

    try {
      await addDoc(collection(db, "users", user.uid, "keywords"), {
        keyword: newKeyword.trim(),
        createdAt: serverTimestamp(),
      });
      setNewKeyword("");
      toast.success("Keyword added");
    } catch (error) {
      toast.error("Failed to add keyword");
    }
  }

  async function handleDeleteKeyword(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "keywords", id));
      toast.success("Keyword removed");
    } catch (error) {
      toast.error("Failed to remove keyword");
    }
  }

  function handleSearchWithKeyword(keyword: string) {
    router.push(`/discover?query=${encodeURIComponent(keyword)}`);
  }

  function handleSearchAllKeywords() {
    router.push("/discover?auto=1");
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Please sign in to access your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your content keywords</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Keyword</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter a keyword (e.g., 'productivity tips')..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading...</p>
            ) : keywords.length === 0 ? (
              <p className="text-gray-500">
                No keywords yet. Add one above to get started.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {keywords.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSearchWithKeyword(item.keyword)}
                    >
                      {item.keyword}
                    </Badge>
                    <button
                      onClick={() => handleDeleteKeyword(item.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button onClick={handleSearchAllKeywords}>Go to Discover</Button>
        </div>
      </div>
    </div>
  );
}
