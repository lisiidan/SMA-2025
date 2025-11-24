import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { TrackingProvider } from "@/utils/tracking/TrackingContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/utils/firebase/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const unstable_settings = {
  initialRouteName: "login",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading, isProcessingImage } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await AsyncStorage.getItem("isAdmin");
      setIsAdmin(adminStatus === "true");
      setAdminCheckDone(true);
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (loading || !adminCheckDone) return;

    const inAuthGroup = segments[0] === "(tabs)";
    const inProtectedRoute =
      segments[0] === "profile" || segments[0] === "leaderboard";
    const inAdminRoute = segments[0] === "admin";
    const inLoginOrSignup = segments[0] === "login" || segments[0] === "signup";

    console.log("Navigation check:", {
      isAdmin,
      user: !!user,
      segments,
      inAdminRoute,
      inAuthGroup,
      inProtectedRoute,
    });

    // Admin poate accesa orice rută (tabs, profile, leaderboard, admin)
    if (isAdmin) {
      console.log("Admin detected - allowing access to all routes");
      return; // Admin has full access, don't redirect
    }

    // Non-admin trying to access admin routes - redirect to login
    if (!isAdmin && inAdminRoute) {
      console.log(
        "Non-admin trying to access admin route - redirecting to login"
      );
      router.replace("/login");
      return;
    }

    // Non-authenticated user trying to access protected routes
    if (!user && (inAuthGroup || inProtectedRoute)) {
      // Don't redirect if already on login/signup
      if (!inLoginOrSignup) {
        console.log("Unauthenticated user - redirecting to login");
        router.replace("/login");
      }
      return;
    }

    // Authenticated non-admin user on login/signup - redirect to map
    if (user && !isAdmin && inLoginOrSignup) {
      console.log("Authenticated user on login page - redirecting to map");
      router.replace("/(tabs)/map");
    }
  }, [user, loading, segments, isAdmin, adminCheckDone, isProcessingImage]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <TrackingProvider>
        <RootLayoutNav />
      </TrackingProvider>
    </AuthProvider>
  );
}
