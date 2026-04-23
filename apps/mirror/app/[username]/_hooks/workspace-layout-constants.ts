// Shared layout constants for the desktop workspace panel group.
// The 50/50 split is the canonical "both panels open" layout; keeping it
// named prevents the literal from drifting across toggle, drag-to-open,
// and route-sync call sites.

export const OPEN_LAYOUT = [50, 50] as const;
