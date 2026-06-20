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
      // Check if user already completed onboarding
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <CardDescription>Get started with TubeForge</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoadingAuth}>
              {isLoadingAuth ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={isLoadingAuth}
          >
            Google
          </Button>

          <p className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
