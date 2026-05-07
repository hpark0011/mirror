import { type Variants } from "framer-motion";

export const articleRowVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 30,
    scale: 0.98,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: index * 0.01,
      type: "spring",
      damping: 20,
      stiffness: 300,
    },
  }),
};
