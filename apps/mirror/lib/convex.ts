import { ConvexReactClient } from "@feel-good/convex";

import { clientEnv } from "@/lib/env/client";

let convexClient: ConvexReactClient | null = null;

/**
 * Get the Convex client singleton.
 * Uses lazy initialization to avoid module-level side effects.
 */
export function getConvexClient(): ConvexReactClient {
  if (convexClient) {
    return convexClient;
  }

  convexClient = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);
  return convexClient;
}
