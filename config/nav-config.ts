export type SidebarNavItem = {
  label: string;
  href: string;
};

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
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
