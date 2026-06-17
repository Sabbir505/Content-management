"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/auth-provider";

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Maps a Firebase auth error code to a user-friendly message.
 */
export function getFirebaseAuthErrorMessage(error: Error): string {
  const message = error.message;
  if (message.includes("auth/wrong-password") || message.includes("auth/invalid-credential")) {
    return "Incorrect email or password.";
  }
  if (message.includes("auth/user-not-found")) {
    return "No account found with this email.";
  }
  if (message.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (message.includes("auth/weak-password")) {
    return "Password should be at least 6 characters.";
  }
  if (message.includes("auth/email-already-in-use")) {
    return "An account already exists with this email.";
  }
  if (message.includes("auth/too-many-requests")) {
    return "Too many failed attempts. Please try again later.";
  }
  if (message.includes("auth/network-request-failed")) {
    return "Network error. Please check your connection and try again.";
  }
  if (message.includes("auth/popup-closed-by-user")) {
    return "Sign-in was cancelled.";
  }
  return message;
}
