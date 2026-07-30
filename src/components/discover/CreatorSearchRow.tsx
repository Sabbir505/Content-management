"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AddToListModal } from "./AddToListModal";

interface CreatorSearchResult {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
}

interface CreatorSearchRowProps {
  creator: CreatorSearchResult;
  onAdded: (creator: CreatorSearchResult) => void;
  isAlreadyAdded: boolean;
}

export function CreatorSearchRow({ creator, onAdded, isAlreadyAdded }: CreatorSearchRowProps) {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  function handleOpenModal() {
    if (!user) {
      toast.error("Sign in to add creators");
      return;
    }
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    onAdded(creator);
  }

  return (
    <>
      <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors">
        {creator.thumbnail ? (
          <Image src={creator.thumbnail} alt={creator.title} width={48} height={48} className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{creator.title}</p>
          <p className="text-xs text-[#888] line-clamp-2">{creator.description}</p>
        </div>
        <Button
          onClick={handleOpenModal}
          disabled={isAlreadyAdded}
          className={isAlreadyAdded
            ? "bg-[#2a2a2a] hover:bg-[#2a2a2a] text-emerald-400 border border-[#3a3a3a] cursor-default"
            : "bg-emerald-400 hover:bg-emerald-500 text-black cursor-pointer"}
        >
          {isAlreadyAdded ? "Added" : "Add to list"}
        </Button>
      </div>

      <AddToListModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        creator={{
          channelId: creator.channelId,
          channelTitle: creator.title,
          thumbnail: creator.thumbnail,
          description: creator.description,
        }}
      />
    </>
  );
}
