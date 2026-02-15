import * as Sentry from "@sentry/nextjs";
import { mirrorServerSentryOptions } from "@/lib/sentry/config";

Sentry.init(mirrorServerSentryOptions);
