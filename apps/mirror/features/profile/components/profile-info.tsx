"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { z } from "zod";
import { toast } from "sonner";
import { CircleCheckIcon, OctagonXIcon } from "lucide-react";
import { api } from "@feel-good/convex/convex/_generated/api";
import {
  Toast,
  ToastClose,
  ToastHeader,
  ToastIcon,
  ToastTitle,
} from "@feel-good/ui/components/toast";

import { Form } from "@feel-good/ui/primitives/form";

import type { Profile } from "../types";
import { EditableProfileActions } from "./editable-profile-actions";
import { EditableName } from "./editable-name";
import { EditableAvatar } from "./editable-avatar";
import { EditableBio } from "./editable-bio";

const editProfileSchema = z.object({
  name: z.string().max(100, "Name must be at most 100 characters"),
  bio: z.string().max(300, "Bio must be at most 300 characters"),
});

type ProfileInfoProps = {
  profile: Profile;
  isEditing: boolean;
  onEditComplete: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onOpenChat?: () => void;
  onOpenVideoCall?: () => void;
};

export function ProfileInfo({
  profile,
  isEditing,
  onEditComplete,
  onSubmittingChange,
  onOpenChat,
  onOpenVideoCall,
}: ProfileInfoProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [prevIsEditing, setPrevIsEditing] = useState(isEditing);
  if (isEditing !== prevIsEditing) {
    setPrevIsEditing(isEditing);
    if (!isEditing) {
      setAvatarPreview(null);
      setAvatarFile(null);
    }
  }

  const updateProfile = useMutation(api.users.mutations.updateProfile)
    .withOptimisticUpdate((localStore, args) => {
      const current = localStore.getQuery(api.users.queries.getByUsername, {
        username: profile.username,
      });
      if (current != null) {
        localStore.setQuery(
          api.users.queries.getByUsername,
          { username: profile.username },
          {
            ...current,
            name: args.name ?? current.name,
            bio: args.bio ?? current.bio,
          },
        );
      }
    });
  const setAvatar = useMutation(api.users.mutations.setAvatar);
  const generateUploadUrl = useMutation(
    api.users.mutations.generateAvatarUploadUrl,
  );

  const form = useForm({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: profile.name ?? "",
      bio: profile.bio ?? "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (!isEditing) {
      form.reset({ name: profile.name ?? "", bio: profile.bio ?? "" });
    }
  }, [isEditing, form, profile.name, profile.bio]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function onSubmit(data: z.infer<typeof editProfileSchema>) {
    onSubmittingChange?.(true);

    try {
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

      await updateProfile({
        name: data.name,
        bio: data.bio,
      });

      toast.custom((t) => (
        <Toast id={t}>
          <ToastIcon className="text-green-9">
            <CircleCheckIcon />
          </ToastIcon>
          <ToastHeader>
            <ToastTitle>Profile updated</ToastTitle>
          </ToastHeader>
          <ToastClose />
        </Toast>
      ));
      onEditComplete();
    } catch {
      toast.custom((t) => (
        <Toast id={t}>
          <ToastIcon className="text-red-9">
            <OctagonXIcon />
          </ToastIcon>
          <ToastHeader>
            <ToastTitle>Failed to update profile</ToastTitle>
          </ToastHeader>
          <ToastClose />
        </Toast>
      ));
      onSubmittingChange?.(false);
    }
  }

  const content = (
    <>
      <EditableName isEditing={isEditing} name={profile.name} />
      <EditableAvatar
        isEditing={isEditing}
        profile={profile}
        avatarPreview={avatarPreview}
        onAvatarChange={handleAvatarChange}
      />
      <div className="w-full flex flex-col items-center justify-center mb-4 mt-2">
        <EditableProfileActions
          isEditing={isEditing}
          onOpenChat={onOpenChat}
          onOpenVideoCall={onOpenVideoCall}
        />
      </div>
      <div className="w-full">
        <EditableBio isEditing={isEditing} bio={profile.bio} />
      </div>
    </>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <Form {...form}>
        <form
          id="edit-profile-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col items-center w-full max-w-md h-full"
        >
          {content}
        </form>
      </Form>
    </div>
  );
}
