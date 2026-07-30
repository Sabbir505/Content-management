"use client";

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createOrUpdateUserProfile, type UserProfile } from "@/lib/user-profile";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);

      if (authUser) {
        try {
          const userProfile = await createOrUpdateUserProfile(authUser);
          // Guard against a sign-out racing this in-flight promise:
          // only commit if this listener invocation is still current.
          if (!cancelled) setProfile(userProfile);
        } catch (error) {
          console.error("Failed to create/update user profile:", error);
        }
      } else {
        setProfile(null);
      }

      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user, profile, isLoading, isAuthenticated: !!user }),
    [user, profile, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

