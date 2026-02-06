// Auth action hooks
export {
  useMagicLinkRequest,
  type UseMagicLinkRequestOptions,
  type UseMagicLinkRequestReturn,
} from "./use-magic-link-request";

export {
  useOTPAuth,
  type UseOTPAuthOptions,
  type UseOTPAuthReturn,
} from "./use-otp-auth";

// Context hook
export { useAuthClient } from "../providers";

// Session hook
export { createUseSession } from "./use-session";
