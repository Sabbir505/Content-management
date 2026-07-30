"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUpWithEmail, signInWithGoogle } from "@/lib/auth";
import { useAuth, getFirebaseAuthErrorMessage } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/discover");
    }
  }, [user, router]);

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoadingAuth(true);
    setError("");

    try {
      await signUpWithEmail(email, password, displayName);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? getFirebaseAuthErrorMessage(err) : "Failed to sign up");
    } finally {
      setIsLoadingAuth(false);
    }
  }

  async function handleGoogleSignUp() {
    setIsLoadingAuth(true);
    setError("");

    try {
      const result = await signInWithGoogle();
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      const profileSnap = await getDoc(doc(db, "users", result.user.uid));
      if (profileSnap.exists() && profileSnap.data()?.onboardingComplete) {
        router.push("/discover");
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? getFirebaseAuthErrorMessage(err) : "Failed to sign up with Google");
    } finally {
      setIsLoadingAuth(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] border-t-white animate-spin" />
          <p className="text-xs text-[#666]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-10">
      <Card className="w-full max-w-md bg-[#1a1a1a] ring-1 ring-[#2a2a2a] border-0">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-white">Create your account</CardTitle>
          <CardDescription className="text-[#888]">Get started with Outlierly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-[#ccc]">Full Name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={isLoadingAuth}
                className="h-10 bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-[#ccc]">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoadingAuth}
                className="h-10 bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-[#ccc]">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoadingAuth}
                  className="h-10 pr-10 bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#666] hover:text-[#ccc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0a0a0a] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.12 9.12 0 0112 4c5 0 9 4.5 9 8 0 1.02-.31 2.07-.83 3.06M6.06 6.06C3.95 7.4 2 9.6 2 12c0 3.5 4 8 10 8 1.6 0 3.07-.4 4.32-1.06" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full h-10 bg-white text-[#0a0a0a] hover:bg-[#ccc] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoadingAuth ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#2a2a2a]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#1a1a1a] px-2 text-[#666]">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-10 bg-[#0a0a0a] border-[#2a2a2a] text-white hover:bg-[#2a2a2a] hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={handleGoogleSignUp}
            disabled={isLoadingAuth}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </Button>

          <p className="text-center text-sm text-[#888]">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-white hover:text-[#ccc] underline underline-offset-2 transition-colors">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
