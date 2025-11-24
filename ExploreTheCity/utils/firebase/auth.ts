/**
 * Firebase Authentication Service
 *
 * Serviciu centralizat pentru toate operațiunile de autentificare
 */

import { createClient } from '@/models/Client';
import {
  AuthError,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './config';

export interface AuthErrorResponse {
  code: string;
  message: string;
}

export interface UserProfile {
  clientId: string;
  name: string;
  email: string;
  accumulatedScore: number;
  mapGridIds: number[];
  imageQuestSolvedIds: number[];
  createdAt: any;
  lastLoginAt?: any;
}

/**
 * Convertește erorile Firebase în mesaje user-friendly
 */
export const getAuthErrorMessage = (error: AuthError): string => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use a stronger password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Înregistrează un utilizator nou
 */
export const registerUser = async (
  email: string,
  password: string,
  displayName: string
): Promise<{ user: User; error?: AuthErrorResponse }> => {
  try {
    // Creează contul de autentificare
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Actualizează profilul cu numele
    await updateProfile(userCredential.user, { displayName });

    // Creează documentul Client în colecția 'clients'
    const clientData = createClient({
      clientId: userCredential.user.uid,
      name: displayName,
      email: userCredential.user.email!,
    });

    await setDoc(doc(db, 'clients', userCredential.user.uid), {
      ...clientData,
      createdAt: serverTimestamp(),
    });

    return { user: userCredential.user };
  } catch (error) {
    const authError = error as AuthError;
    return {
      user: null as any,
      error: {
        code: authError.code,
        message: getAuthErrorMessage(authError),
      },
    };
  }
};

/**
 * Autentifică un utilizator existent
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<{ user: User; error?: AuthErrorResponse }> => {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Actualizează timpul ultimei autentificări în colecția clients
    await setDoc(
      doc(db, 'clients', userCredential.user.uid),
      { lastLoginAt: serverTimestamp() },
      { merge: true }
    );

    return { user: userCredential.user };
  } catch (error) {
    const authError = error as AuthError;
    return {
      user: null as any,
      error: {
        code: authError.code,
        message: getAuthErrorMessage(authError),
      },
    };
  }
};

/**
 * Deconectează utilizatorul curent
 */
export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError),
    };
  }
};

/**
 * Trimite email de resetare parolă
 */
export const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    const authError = error as AuthError;
    return {
      success: false,
      error: getAuthErrorMessage(authError),
    };
  }
};

/**
 * Obține profilul utilizatorului din Firestore (colecția clients)
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const docRef = doc(db, 'clients', uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

/**
 * Obține utilizatorul curent autentificat
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Obține top 10 clienți după scor acumulat pentru leaderboard
 */
export const getTopClients = async (limit: number = 10): Promise<UserProfile[]> => {
  try {
    const { collection, getDocs, query, orderBy, limit: firestoreLimit } = await import('firebase/firestore');
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, orderBy('accumulatedScore', 'desc'), firestoreLimit(limit));
    const querySnapshot = await getDocs(q);

    const clients: UserProfile[] = [];
    querySnapshot.forEach((doc) => {
      clients.push(doc.data() as UserProfile);
    });

    return clients;
  } catch (error) {
    console.error('Error fetching top clients:', error);
    return [];
  }
};

/**
 * Obține rankul unui utilizator bazat pe scorul său comparat cu toți ceilalți utilizatori
 */
export const getUserRank = async (userId: string): Promise<number> => {
  try {
    const { collection, getDocs, query, orderBy, where } = await import('firebase/firestore');
    const clientsRef = collection(db, 'clients');
    
    // Get the user's profile first
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      return 0;
    }

    const userScore = userProfile.accumulatedScore || 0;

    // Count how many users have a higher score
    const q = query(
      clientsRef,
      where('accumulatedScore', '>', userScore),
      orderBy('accumulatedScore', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    // Rank is the number of users with higher score + 1
    return querySnapshot.size + 1;
  } catch (error) {
    console.error('Error fetching user rank:', error);
    return 0;
  }
};
