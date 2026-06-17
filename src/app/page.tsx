"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/discover");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          V1 Core — Now Available
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          TubeForge
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mb-8">
          YouTube Intelligence & Content Creation Platform. Find viral content,
          understand its structure, and produce your own version — all in your unique voice.
        </p>
        <div className="flex gap-4">
          <Button size="lg" onClick={() => router.push("/auth/signup")}>
            Get Started
          </Button>
          <Button size="lg" variant="outline" onClick={() => router.push("/auth/login")}>
            Sign In
          </Button>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">What you can do</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Discover</CardTitle>
                <CardDescription>Find viral YouTube content in your niche</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Browse trending videos, filter by niche, and analyze what makes content perform.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Create</CardTitle>
                <CardDescription>Generate scripts and social posts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  AI-powered script generation in your voice, plus social posts for X, Instagram, and Facebook.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Optimize</CardTitle>
                <CardDescription>SEO-optimize your videos</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Generate titles, descriptions, tags, and thumbnail ideas to maximize discoverability.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analyze</CardTitle>
                <CardDescription>Channel performance insights</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Import your channel, get performance scores, and identify what to double down on.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
