"use client";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AUTH_METHODS, DEFAULT_AUTH_METHOD } from "@/config/auth.config";
import { Lock, Sparkles } from "lucide-react";
import { useState } from "react";
import { MagicLinkForm } from "./magic-link-form";
import { PasswordForm } from "./password-form";
import { SocialAuth } from "./social-auth";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
}

export function AuthForm({ mode }: AuthFormProps) {
  const [activeMethod, setActiveMethod] = useState<"password" | "magic-link">(
    DEFAULT_AUTH_METHOD === "magicLink" ? "magic-link" : "password"
  );

  const hasMultipleMethods =
    [AUTH_METHODS.password.enabled, AUTH_METHODS.magicLink.enabled].filter(
      Boolean
    ).length > 1;

  const hasOAuth =
    AUTH_METHODS.oauth.enabled && AUTH_METHODS.oauth.providers.length > 0;

  return (
    <div className='w-full space-y-6'>
      {hasOAuth && (
        <>
          <SocialAuth mode={mode} />
          {(AUTH_METHODS.password.enabled ||
            AUTH_METHODS.magicLink.enabled) && (
            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <Separator />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-background px-2 text-muted-foreground'>
                  Or continue with
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {hasMultipleMethods ? (
        <Tabs
          value={activeMethod}
          onValueChange={(value) =>
            setActiveMethod(value as "password" | "magic-link")
          }
          className='w-full'
        >
          <TabsList
            className='grid w-full grid-cols-2'
            data-slot='auth-method-tabs'
          >
            {AUTH_METHODS.password.enabled && (
              <TabsTrigger value='password' className='space-x-2'>
                <Lock className='h-4 w-4' />
                <span>Password</span>
              </TabsTrigger>
            )}
            {AUTH_METHODS.magicLink.enabled && (
              <TabsTrigger value='magic-link' className='space-x-2'>
                <Sparkles className='h-4 w-4' />
                <span>Magic Link</span>
              </TabsTrigger>
            )}
          </TabsList>

          {AUTH_METHODS.password.enabled && (
            <TabsContent value='password' className='mt-6'>
              <PasswordForm mode={mode} />
            </TabsContent>
          )}

          {AUTH_METHODS.magicLink.enabled && (
            <TabsContent value='magic-link' className='mt-6'>
              <MagicLinkForm mode={mode} />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <>
          {AUTH_METHODS.password.enabled && <PasswordForm mode={mode} />}
          {AUTH_METHODS.magicLink.enabled && !AUTH_METHODS.password.enabled && (
            <MagicLinkForm mode={mode} />
          )}
        </>
      )}
    </div>
  );
}
