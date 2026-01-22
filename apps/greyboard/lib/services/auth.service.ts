import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { AUTH_ERRORS } from "@/config/auth.config";

export class AuthService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Map common Supabase errors to our error messages
        if (error.message.includes("Invalid login credentials")) {
          throw new Error(AUTH_ERRORS.INVALID_CREDENTIALS);
        }
        if (error.message.includes("User not found")) {
          throw new Error(AUTH_ERRORS.USER_NOT_FOUND);
        }
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      // Re-throw with meaningful message
      throw error instanceof Error
        ? error
        : new Error(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }

  async signUp(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        // Map common Supabase errors to our error messages
        if (error.message.includes("User already registered")) {
          throw new Error(AUTH_ERRORS.USER_ALREADY_EXISTS);
        }
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      // Re-throw with meaningful message
      throw error instanceof Error
        ? error
        : new Error(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }

  async sendMagicLink(email: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      // Re-throw with meaningful message
      throw error instanceof Error
        ? error
        : new Error(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }

  async sendPasswordResetEmail(email: string) {
    try {
      const { data, error } = await this.supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/reset-password`,
        }
      );

      if (error) {
        if (error.message.includes("User not found")) {
          throw new Error(AUTH_ERRORS.USER_NOT_FOUND);
        }
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      // Re-throw with meaningful message
      throw error instanceof Error
        ? error
        : new Error(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }

  async resetPassword(password: string) {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        password,
      });

      if (error) {
        if (error.message.includes("Invalid token")) {
          throw new Error(AUTH_ERRORS.INVALID_TOKEN);
        }
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      // Re-throw with meaningful message
      throw error instanceof Error
        ? error
        : new Error(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      // Re-throw with meaningful message
      throw error instanceof Error
        ? error
        : new Error(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }
}
