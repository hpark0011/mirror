import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import betterAuth from "@convex-dev/better-auth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

const app = defineApp();
app.use(agent);
app.use(betterAuth);
app.use(rateLimiter);
app.use(resend);
app.use(migrations);

export default app;
