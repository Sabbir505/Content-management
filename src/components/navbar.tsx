"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logOut } from "@/lib/auth";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/command/CommandPalette";

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  async function handleLogout() {
    try {
      await logOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to log out. Please try again.");
    }
  }

  return (
    <nav className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-white">
              TubeForge
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={() => setCommandOpen(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search</span>
                  <kbd className="ml-2 text-xs text-[#666] bg-[#2a2a2a] px-1.5 py-0.5 rounded">⌘K</kbd>
                </button>

                <Link href="/discover" className="text-sm font-medium text-[#888] hover:text-white transition-colors">
                  Discover
                </Link>
                <Link href="/boards" className="text-sm font-medium text-[#888] hover:text-white transition-colors">
                  Workspace
                </Link>
                <Link href="/creators" className="text-sm font-medium text-[#888] hover:text-white transition-colors">
                  Creators
                </Link>
                <Link href="/optimize" className="text-sm font-medium text-[#888] hover:text-white transition-colors">
                  Optimize
                </Link>
                <Link href="/channel" className="text-sm font-medium text-[#888] hover:text-white transition-colors">
                  Channel
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                      <AvatarFallback className="bg-[#1a1a1a] text-white">{user.displayName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-[#1a1a1a] border-[#2a2a2a]" align="end">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        {user.displayName && (
                          <p className="font-medium text-white">{user.displayName}</p>
                        )}
                        {user.email && (
                          <p className="w-[200px] truncate text-sm text-[#888]">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator className="bg-[#2a2a2a]" />
                    <DropdownMenuItem onClick={() => router.push("/voice")} className="text-white hover:bg-[#2a2a2a] cursor-pointer">
                      Voice Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings/performance")} className="text-white hover:bg-[#2a2a2a] cursor-pointer">
                      Performance Insights
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#2a2a2a]" />
                    <DropdownMenuItem
                      className="cursor-pointer text-red-400 hover:bg-[#2a2a2a]"
                      onClick={handleLogout}
                    >
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => router.push("/auth/login")}>
                  Sign in
                </Button>
                <Button onClick={() => router.push("/auth/signup")}>
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </nav>
  );
}
