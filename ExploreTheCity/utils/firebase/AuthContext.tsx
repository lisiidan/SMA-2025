/**
 * Authentication Context
 *
 * Providează starea de autentificare și funcții pentru întreaga aplicație
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './config';
import {
  registerUser,
  loginUser,
  logoutUser,
  resetPassword,
  getUserProfile,
  UserProfile,
  AuthErrorResponse
} from './auth';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isProcessingImage: boolean;
  setIsProcessingImage: (isProcessing: boolean) => void;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: AuthErrorResponse }>;
  signIn: (email: string, password: string) => Promise<{ error?: AuthErrorResponse }>;
  signOut: () => Promise<{ error?: string }>;
  resetUserPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    // Ascultă schimbările de autentificare
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Încarcă profilul utilizatorului din Firestore
        const profile = await getUserProfile(firebaseUser.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<{ error?: AuthErrorResponse }> => {
    const { error } = await registerUser(email, password, displayName);
    return { error };
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: AuthErrorResponse }> => {
    const { error } = await loginUser(email, password);
    return { error };
  };

  const signOut = async (): Promise<{ error?: string }> => {
    const result = await logoutUser();
    if (!result.success) {
      return { error: result.error };
    }
    return {};
  };

  const resetUserPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    return await resetPassword(email);
  };

  const refreshUserProfile = async (): Promise<void> => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      setUserProfile(profile);
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    isProcessingImage,
    setIsProcessingImage,
    signUp,
    signIn,
    signOut,
    resetUserPassword,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook pentru a accesa contextul de autentificare
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
