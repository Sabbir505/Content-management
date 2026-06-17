"use client";

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

export function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

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
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold">
              TubeForge
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                <Link href="/discover" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  Discover
                </Link>
                <Link href="/create" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  Create
                </Link>
                <Link href="/optimize" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  Optimize
                </Link>
                <Link href="/channel" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  Channel
                </Link>
                <Link href="/boards" className="text-sm font-medium text-gray-700 hover:text-gray-900">
                  Boards
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                      <AvatarFallback>{user.displayName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        {user.displayName && (
                          <p className="font-medium">{user.displayName}</p>
                        )}
                        {user.email && (
                          <p className="w-[200px] truncate text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/voice")}>
                      Voice Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings/performance")}>
                      Performance Insights
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
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
    </nav>
  );
}
