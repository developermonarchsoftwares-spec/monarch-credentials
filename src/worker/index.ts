import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./env";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { studentRoutes } from "./routes/admin-students";
import { certificateRoutes } from "./routes/admin-certificates";
import { miscRoutes } from "./routes/admin-misc";
import { requireAuth } from "./lib/session";

export const app = new Hono<AppEnv>();

app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    referrerPolicy: "strict-origin-when-cross-origin",
    xFrameOptions: "DENY",
  }),
);

app.route("/api/public", publicRoutes);
app.route("/api/auth", authRoutes);

const admin = new Hono<AppEnv>();
admin.use("*", requireAuth);
admin.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});
admin.route("/students", studentRoutes);
admin.route("/certificates", certificateRoutes);
admin.route("/", miscRoutes);
app.route("/api/admin", admin);

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Never leak internals: log server-side, return a generic message.
app.onError((err, c) => {
  console.error("Unhandled error", err instanceof Error ? err.message : err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default app;
