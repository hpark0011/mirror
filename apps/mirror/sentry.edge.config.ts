import * as Sentry from "@sentry/nextjs";
import { mirrorEdgeSentryOptions } from "@/lib/sentry/config";

Sentry.init(mirrorEdgeSentryOptions);
