"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { CameraIcon, Loader2Icon } from "lucide-react";

import { Button } from "@feel-good/ui/primitives/button";
import { Textarea } from "@feel-good/ui/primitives/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@feel-good/ui/primitives/avatar";

type ProfileStepProps = {
  username: string;
  onComplete: () => void;
};

export function ProfileStep({ username, onComplete }: ProfileStepProps) {
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProfile = useMutation(api.users.updateProfile);
  const setAvatar = useMutation(api.users.setAvatar);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    setIsSubmitting(true);

    try {
      // Upload avatar if selected
      if (avatarFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": avatarFile.type },
          body: avatarFile,
        });
        const { storageId } = await result.json();
        await setAvatar({ storageId });
      }

      // Save bio if provided
      if (bio.trim()) {
        await updateProfile({ bio: bio.trim() });
      }

      // Mark onboarding as complete
      await completeOnboarding();
      onComplete();
    } catch {
      setIsSubmitting(false);
    }
  }

  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[480px] space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Set up your profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a photo and bio. You can always change these later.
          </p>
        </div>

        <div className="space-y-6">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative size-24 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="size-24">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt="Profile photo" />
                ) : null}
                <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <CameraIcon className="size-6 text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Click to upload a photo
            </p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label
              htmlFor="bio"
              className="text-sm font-medium text-foreground"
            >
              Bio
            </label>
            <Textarea
              id="bio"
              placeholder="Tell people a little about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/300
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              "Complete"
            )}
          </Button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
