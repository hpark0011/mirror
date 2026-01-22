"use server";

import { enhanceAction } from "@/utils/enhance-actions";
import { AuthService } from "@/lib/services/auth.service";
import { getSupabaseServerClient } from "@/utils/supabase/client/supabase-server";
import {
  signInSchema,
  signUpSchema,
  magicLinkSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/schema/auth.schema";
import { AUTH_ERRORS } from "@/config/auth.config";

export type ActionResponse<T = void> =
  | { success: true; data?: T }
  | { success: false; errors?: Record<string, string[]>; message?: string };

/**
 * @name getAuthService
 * @description Creates an instance of the AuthService
 * @returns
 */
async function getAuthService() {
  const supabase = await getSupabaseServerClient();
  return new AuthService(supabase);
}

/**
 * @name signInAction
 * @description Signs in a user with email and password
 * @param data
 * @returns
 */
export const signInAction = enhanceAction(
  async (data): Promise<ActionResponse> => {
    try {
      const service = await getAuthService();
      await service.signIn(data.email, data.password);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : AUTH_ERRORS.UNKNOWN_ERROR,
      };
    }
  },
  {
    schema: signInSchema,
    auth: false, // No authentication required for sign in
  }
);

/**
 * @name signUpAction
 * @description Signs up a user with email and password
 * @param data
 * @returns
 */
export const signUpAction = enhanceAction(
  async (data): Promise<ActionResponse> => {
    try {
      const service = await getAuthService();
      await service.signUp(data.email, data.password);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : AUTH_ERRORS.UNKNOWN_ERROR,
      };
    }
  },
  {
    schema: signUpSchema,
    auth: false, // No authentication required for sign up
  }
);

/**
 * @name magicLinkAction
 * @description Sends a magic link to the user's email
 * @param data
 * @returns
 */
export const magicLinkAction = enhanceAction(
  async (data): Promise<ActionResponse> => {
    try {
      const service = await getAuthService();
      await service.sendMagicLink(data.email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : AUTH_ERRORS.UNKNOWN_ERROR,
      };
    }
  },
  {
    schema: magicLinkSchema,
    auth: false, // No authentication required for magic link
  }
);

/**
 * @name forgotPasswordAction
 * @description Sends a password reset email to the user's email
 * @param data
 * @returns
 */
export const forgotPasswordAction = enhanceAction(
  async (data): Promise<ActionResponse> => {
    try {
      const service = await getAuthService();
      await service.sendPasswordResetEmail(data.email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : AUTH_ERRORS.UNKNOWN_ERROR,
      };
    }
  },
  {
    schema: forgotPasswordSchema,
    auth: false, // No authentication required for forgot password
  }
);

/**
 * @name resetPasswordAction
 * @description Resets the user's password
 * @param data
 * @returns
 */
export const resetPasswordAction = enhanceAction(
  async (data): Promise<ActionResponse> => {
    try {
      const service = await getAuthService();
      await service.resetPassword(data.password);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : AUTH_ERRORS.UNKNOWN_ERROR,
      };
    }
  },
  {
    schema: resetPasswordSchema,
    auth: false, // No authentication required for reset password (user has token)
  }
);

/**
 * @name signOutAction
 * @description Signs out the current user
 * @returns
 */
export const signOutAction = enhanceAction(
  async (): Promise<ActionResponse> => {
    try {
      const service = await getAuthService();
      await service.signOut();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : AUTH_ERRORS.UNKNOWN_ERROR,
      };
    }
  },
  {
    auth: true, // User must be authenticated to sign out
  }
);
