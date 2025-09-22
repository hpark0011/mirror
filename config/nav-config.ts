export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Files",
    href: "/files",
  },
  {
    label: "Tasks",
    href: "/tasks",
  },
  {
    label: "Agents",
    href: "/agents",
  },
];
