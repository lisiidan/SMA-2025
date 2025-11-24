/**
 * Firebase - Export centralizat
 *
 * Import-uri simple pentru întreaga aplicație:
 * import { useAuth, auth, db } from '@/utils/firebase';
 */

// Export configurația Firebase
export { auth, db, app } from './config';

// Export serviciile de autentificare
export {
  registerUser,
  loginUser,
  logoutUser,
  resetPassword,
  getUserProfile,
  getCurrentUser,
  getAuthErrorMessage,
} from './auth';

// Export tipuri
export type { AuthErrorResponse, UserProfile } from './auth';

// Export context și hook
export { AuthProvider, useAuth } from './AuthContext';
