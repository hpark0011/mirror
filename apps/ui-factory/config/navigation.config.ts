export type NavItem = {
  label: string;
  href: string;
};

export const COMPONENT_NAV_ITEMS: NavItem[] = [
  { label: "Button", href: "/components/buttons" },
  { label: "Data Table", href: "/components/data-table" },
  { label: "Dialog", href: "/components/dialog" },
  { label: "Input", href: "/components/input" },
  { label: "Input Group", href: "/components/input-group" },
  { label: "Switch", href: "/components/switch" },
  { label: "Table", href: "/components/table" },
  { label: "Drawer", href: "/components/drawer" },
  { label: "Dropdown Menu", href: "/components/dropdown-menu" },
  { label: "Resizable", href: "/components/resizable" },
  { label: "Sonner", href: "/components/sonner" },
];

export const BLOCK_NAV_ITEMS: NavItem[] = [
  { label: "Login", href: "/blocks/login" },
  { label: "Sign Up", href: "/blocks/sign-up" },
  { label: "Dock", href: "/blocks/dock" },
];
