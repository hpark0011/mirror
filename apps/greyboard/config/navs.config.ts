export type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Files",
    href: "/dashboard/files",
  },
  {
    label: "Tasks",
    href: "/dashboard/tasks",
  },
  {
    label: "Agents",
    href: "/dashboard/agents",
  },
];
