export function getProfileInitials(profileName: string) {
  return profileName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
