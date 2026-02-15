import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

type SharedSentryOptions = Pick<
  BrowserOptions,
  | "dsn"
  | "enabled"
  | "environment"
  | "release"
  | "tracesSampleRate"
  | "sendDefaultPii"
  | "initialScope"
>;

function parseTracesSampleRate(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }

  if (parsedValue < 0 || parsedValue > 1) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }

  return parsedValue;
}

function createSharedSentryOptions(appName: string): SharedSentryOptions {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: parseTracesSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    sendDefaultPii: false,
    initialScope: {
      tags: {
        app: appName,
      },
    },
  };
}

export function createClientSentryOptions(appName: string): BrowserOptions {
  return {
    ...createSharedSentryOptions(appName),
  };
}

export function createServerSentryOptions(appName: string): NodeOptions {
  return {
    ...createSharedSentryOptions(appName),
  };
}

export function createEdgeSentryOptions(appName: string): EdgeOptions {
  return {
    ...createSharedSentryOptions(appName),
  };
}
