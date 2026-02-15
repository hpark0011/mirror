import * as Sentry from "@sentry/nextjs";
import { mirrorClientSentryOptions } from "@/lib/sentry/config";

Sentry.init(mirrorClientSentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
