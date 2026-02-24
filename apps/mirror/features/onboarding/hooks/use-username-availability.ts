"use client";

import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { isReservedUsername } from "@/lib/reserved-usernames";

const USERNAME_FORMAT = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

type UseUsernameAvailabilityReturn = {
  isAvailable: boolean | null;
  isChecking: boolean;
};

export function useUsernameAvailability(
  username: string
): UseUsernameAvailabilityReturn {
  const [debouncedUsername, setDebouncedUsername] = useState<string>("");

  useEffect(() => {
    const trimmed = username.trim();
    const isValid = trimmed && USERNAME_FORMAT.test(trimmed) && !isReservedUsername(trimmed);

    const timer = setTimeout(() => {
      setDebouncedUsername(isValid ? trimmed : "");
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  const isTaken = useQuery(
    api.users.isUsernameTaken,
    debouncedUsername ? { username: debouncedUsername } : "skip"
  );

  // If reserved, immediately return unavailable without querying
  if (username.trim() && isReservedUsername(username.trim())) {
    return { isAvailable: false, isChecking: false };
  }

  // If no valid debounced username, not checking
  if (!debouncedUsername) {
    return { isAvailable: null, isChecking: false };
  }

  // If query is still loading (undefined)
  if (isTaken === undefined) {
    return { isAvailable: null, isChecking: true };
  }

  return { isAvailable: !isTaken, isChecking: false };
}
