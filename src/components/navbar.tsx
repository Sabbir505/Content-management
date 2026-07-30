"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CommandPalette } from "@/components/command/CommandPalette";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/channel", label: "Channel" },
  { href: "/optimize", label: "Optimize" },
] as const;

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

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

  return (
    <nav className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] rounded-md px-1"
            >
              Outlierly
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={() => setCommandOpen(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-[#ccc] hover:text-white hover:border-[#3a3a3a] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search</span>
                  <kbd className="ml-2 text-xs text-[#666] bg-[#2a2a2a] px-1.5 py-0.5 rounded">⌘K</kbd>
                </button>

                <nav className="hidden md:flex items-center gap-1">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "text-sm font-medium px-3 py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a]",
                        isActive(link.href)
                          ? "text-white bg-[#1a1a1a] border border-[#2a2a2a]"
                          : "text-[#888] hover:text-white hover:bg-[#1a1a1a] border border-transparent"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <button
                  onClick={() => setMobileOpen((open) => !open)}
                  className="md:hidden p-2 rounded-md text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer"
                  aria-label="Toggle menu"
                  aria-expanded={mobileOpen}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                  </svg>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger className="relative h-8 w-8 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer">
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => router.push("/auth/login")} className="focus-visible:ring-2 focus-visible:ring-[#3a3a3a]">
                  Sign in
                </Button>
                <Button onClick={() => router.push("/auth/signup")} className="focus-visible:ring-2 focus-visible:ring-[#3a3a3a]">
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </div>

        {mobileOpen && isAuthenticated && (
          <nav className="md:hidden border-t border-[#2a2a2a] px-4 py-2 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "text-white bg-[#1a1a1a] border border-[#2a2a2a]"
                    : "text-[#888] hover:text-white hover:bg-[#1a1a1a] border border-transparent"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </nav>
  );
}
