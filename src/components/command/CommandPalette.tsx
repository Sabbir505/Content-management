"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  const runCommand = useCallback((cmd: () => void) => {
    onOpenChange(false);
    cmd();
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." className="focus-visible:ring-[#3a3a3a]" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/discover"))}
            className="cursor-pointer"
          >
            <svg className="w-4 h-4 mr-2 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Go to Discover
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/discover?tab=creators"))}
            className="cursor-pointer"
          >
            <svg className="w-4 h-4 mr-2 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Go to Creators
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/dashboard"))}
            className="cursor-pointer"
          >
            <svg className="w-4 h-4 mr-2 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Go to Dashboard
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/discover"))}
            className="cursor-pointer"
          >
            <svg className="w-4 h-4 mr-2 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            Track New Creator
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
