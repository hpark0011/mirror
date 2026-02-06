"use node";

import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const resend = new Resend(components.resend);

// Configurable email sender settings via environment variables
// Using || instead of ?? to also handle empty strings as falsy
const APP_NAME = process.env.APP_NAME || "Mirror";
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "mirror.app";
const EMAIL_FROM = `${APP_NAME} <auth@${EMAIL_DOMAIN}>`;

interface EmailTemplateConfig {
  title: string;
  message: string;
  buttonText: string;
  link: string;
  footerText: string;
}

interface OTPEmailTemplateConfig {
  title: string;
  otp: string;
  message: string;
  footerText: string;
}

function createEmailTemplate(config: EmailTemplateConfig): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f9fafb;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">${config.title}</h1>
        <p style="margin: 0 0 24px; color: #6b7280; line-height: 1.6;">${config.message}</p>
        <a href="${config.link}" style="display: inline-block; padding: 12px 24px; background: #111827; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">${config.buttonText}</a>
        <p style="margin: 24px 0 0; font-size: 14px; color: #9ca3af;">${config.footerText}</p>
      </div>
    </body>
    </html>
  `;
}

function createOTPEmailTemplate(config: OTPEmailTemplateConfig): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #f9fafb;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #111827;">${config.title}</h1>
        <p style="margin: 0 0 24px; color: #6b7280; line-height: 1.6;">${config.message}</p>
        <div style="margin: 0 0 24px; padding: 16px 24px; background: #f3f4f6; border-radius: 8px; text-align: center;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 0.25em; color: #111827;">${config.otp}</span>
        </div>
        <p style="margin: 0; font-size: 14px; color: #9ca3af;">${config.footerText}</p>
      </div>
    </body>
    </html>
  `;
}

export const sendMagicLink = internalAction({
  args: {
    to: v.string(),
    link: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { to, link }) => {
    await resend.sendEmail(ctx, {
      from: EMAIL_FROM,
      to,
      subject: `Sign in to ${APP_NAME}`,
      html: createEmailTemplate({
        title: `Sign in to ${APP_NAME}`,
        message:
          "Click the button below to sign in to your account. This link will expire in 15 minutes.",
        buttonText: "Sign In",
        link,
        footerText:
          "If you didn't request this email, you can safely ignore it.",
      }),
    });
    return null;
  },
});

export const sendVerificationEmail = internalAction({
  args: {
    to: v.string(),
    link: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { to, link }) => {
    await resend.sendEmail(ctx, {
      from: EMAIL_FROM,
      to,
      subject: `Verify your ${APP_NAME} email address`,
      html: createEmailTemplate({
        title: "Verify your email",
        message:
          "Thanks for signing up! Please verify your email address by clicking the button below.",
        buttonText: "Verify Email",
        link,
        footerText:
          "If you didn't create an account, you can safely ignore this email.",
      }),
    });
    return null;
  },
});

export const sendOTP = internalAction({
  args: {
    to: v.string(),
    otp: v.string(),
    type: v.union(
      v.literal("sign-in"),
      v.literal("sign-up"),
      v.literal("email-verification"),
      v.literal("forget-password"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { to, otp, type }) => {
    await resend.sendEmail(ctx, {
      from: EMAIL_FROM,
      to,
      subject: `Your ${APP_NAME} verification code`,
      html: createOTPEmailTemplate({
        title: "Your verification code",
        otp,
        message:
          type === "sign-up"
            ? "Use the code below to complete your sign up."
            : "Use the code below to sign in to your account.",
        footerText:
          "This code will expire in 5 minutes. If you didn't request this code, you can safely ignore this email.",
      }),
    });
    return null;
  },
});

