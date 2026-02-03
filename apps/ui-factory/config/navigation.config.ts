export type NavItem = {
  label: string;
  href: string;
};

export const COMPONENT_NAV_ITEMS: NavItem[] = [
  { label: "Button", href: "/components/buttons" },
  { label: "Input", href: "/components/input" },
  { label: "Switch", href: "/components/switch" },
];

export const BLOCK_NAV_ITEMS: NavItem[] = [
  { label: "Login", href: "/blocks/login" },
  { label: "Sign Up", href: "/blocks/sign-up" },
];
