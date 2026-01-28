"use node";

import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { action } from "./_generated/server";
import { v } from "convex/values";

const resend = new Resend(components.resend);

export const sendMagicLink = action({
  args: {
    to: v.string(),
    link: v.string(),
  },
  handler: async (ctx, { to, link }) => {
    await resend.sendEmail(ctx, {
      from: "Mirror <auth@mirror.app>",
      to,
      subject: "Sign in to Mirror",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f9fafb;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Sign in to Mirror</h1>
            <p style="margin: 0 0 24px; color: #6b7280; line-height: 1.6;">Click the button below to sign in to your account. This link will expire in 15 minutes.</p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #111827; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Sign In</a>
            <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">If you didn't request this email, you can safely ignore it.</p>
          </div>
        </body>
        </html>
      `,
    });
  },
});

export const sendVerificationEmail = action({
  args: {
    to: v.string(),
    link: v.string(),
  },
  handler: async (ctx, { to, link }) => {
    await resend.sendEmail(ctx, {
      from: "Mirror <auth@mirror.app>",
      to,
      subject: "Verify your email address",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f9fafb;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Verify your email</h1>
            <p style="margin: 0 0 24px; color: #6b7280; line-height: 1.6;">Thanks for signing up! Please verify your email address by clicking the button below.</p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #111827; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Verify Email</a>
            <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });
  },
});

export const sendPasswordReset = action({
  args: {
    to: v.string(),
    link: v.string(),
  },
  handler: async (ctx, { to, link }) => {
    await resend.sendEmail(ctx, {
      from: "Mirror <auth@mirror.app>",
      to,
      subject: "Reset your password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f9fafb;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">Reset your password</h1>
            <p style="margin: 0 0 24px; color: #6b7280; line-height: 1.6;">Click the button below to reset your password. This link will expire in 1 hour.</p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #111827; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Reset Password</a>
            <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });
  },
});
