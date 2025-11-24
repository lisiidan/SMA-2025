import { Button } from "@/components/auth/Button";
import { FormInput } from "@/components/auth/FormInput";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/utils/firebase/AuthContext";
import { validateEmail } from "@/utils/validation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// 🔐 CREDENȚIALE ADMIN HARDCODATE
const ADMIN_EMAIL = "admin@walkwithme.com";
const ADMIN_PASSWORD = "Admin122";

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [loading, setLoading] = useState(false);

  // Quick fill admin credentials
  // const fillAdminCredentials = () => {
  //   setEmail(ADMIN_EMAIL);
  //   setPassword(ADMIN_PASSWORD);
  //   setErrors({});
  // };

  const handleLogin = async () => {
    // Clear previous errors
    setErrors({});

    // Validare email și parolă
    if (!email.trim()) {
      setErrors({ email: "Email is required" });
      return;
    }

    if (!password) {
      setErrors({ password: "Password is required" });
      return;
    }

    setLoading(true);

    try {
      console.log("=== LOGIN ATTEMPT ===");
      console.log("Email entered:", email);
      console.log("Email trimmed:", email.trim());
      console.log("Email lowercase:", email.trim().toLowerCase());
      console.log("Expected admin email:", ADMIN_EMAIL);
      console.log("Expected admin email lowercase:", ADMIN_EMAIL.toLowerCase());
      console.log("Password entered:", password);
      console.log("Expected password:", ADMIN_PASSWORD);
      console.log(
        "Email match:",
        email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()
      );
      console.log("Password match:", password === ADMIN_PASSWORD);

      // ✅ VERIFICARE ADMIN: Credențiale hardcodate (fără Firebase)
      if (
        email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
        password === ADMIN_PASSWORD
      ) {
        console.log("🔐 Admin login successful!");
        console.log("Setting admin flags in AsyncStorage...");

        // Salvează starea de admin în AsyncStorage
        await AsyncStorage.setItem("isAdmin", "true");
        await AsyncStorage.setItem("adminEmail", ADMIN_EMAIL);
        await AsyncStorage.setItem("userEmail", email.trim());

        console.log("Admin flags set successfully");
        console.log("Navigating to admin dashboard...");

        // Redirect to admin dashboard
        setLoading(false);

        // Try navigation with error handling
        try {
          router.replace("/admin/dashboard");
          console.log("Navigation to admin dashboard initiated");
        } catch (navError) {
          console.error("Navigation error:", navError);
          Alert.alert(
            "Navigation Error",
            "Could not navigate to admin dashboard. Please restart the app."
          );
        }

        return;
      }

      console.log("❌ Admin credentials did not match");

      // Check if user was trying to login as admin (but credentials were wrong)
      if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        // Email matches admin email, but password was wrong
        console.log("❌ Admin password incorrect");
        setErrors({ password: "Invalid admin password" });
        setLoading(false);
        return;
      }

      // Not admin login attempt - proceed to Firebase authentication
      console.log("Proceeding to Firebase auth for regular user");

      // Validare email pentru useri normali
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        setErrors({
          email: emailValidation.error,
        });
        setLoading(false);
        return;
      }

      // Pentru useri normali - Firebase authentication
      const { error } = await signIn(email, password);

      if (error) {
        setErrors({ password: error.message });
      } else {
        console.log("Login successful (regular user)");
        await AsyncStorage.removeItem("isAdmin");
        router.replace("/(tabs)/map");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setErrors({
        password: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: colors.icon }]}>
            Sign in to continue
          </Text>
        </View>

        <View style={styles.form}>
          <FormInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <FormInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
          />

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: colors.tint }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          {/* Quick Admin Login Button */}
          {/* <TouchableOpacity
            style={styles.adminQuickFill}
            onPress={fillAdminCredentials}
            disabled={loading}
          >
            <Text style={styles.adminQuickFillText}>🔑 Quick Admin Login</Text>
          </TouchableOpacity> */}

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <View style={styles.divider}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.icon }]}
            />
            <Text style={[styles.dividerText, { color: colors.icon }]}>or</Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.icon }]}
            />
          </View>

          <View style={styles.signupContainer}>
            <Text style={[styles.signupText, { color: colors.icon }]}>
              Don't have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text style={[styles.signupLink, { color: colors.tint }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  logo: {
    width: 200,
    height: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
  },
  adminQuickFill: {
    backgroundColor: "#FF6B35",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  adminQuickFillText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  loginButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});
