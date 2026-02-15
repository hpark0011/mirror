import {
  createClientSentryOptions,
  createEdgeSentryOptions,
  createServerSentryOptions,
} from "@feel-good/sentry-config/nextjs";

const APP_NAME = "@feel-good/mirror";

export const mirrorClientSentryOptions = createClientSentryOptions(APP_NAME);
export const mirrorServerSentryOptions = createServerSentryOptions(APP_NAME);
export const mirrorEdgeSentryOptions = createEdgeSentryOptions(APP_NAME);
