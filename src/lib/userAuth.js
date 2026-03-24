// Multi-tenant user authentication for LifeOS SaaS
import { supabase } from "./supabase";

export class UserAuthManager {
  // User registration
  static async signUp(email, password, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            plan: "free", // Default plan
          },
        },
      });

      if (error) throw error;

      console.log("✅ User registered:", email);
      return data;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  // User login
  static async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      console.log("✅ User logged in:", email);
      return data;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  // Get current user
  static async getCurrentUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Sign out
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      console.log("✅ User logged out");
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }
}

