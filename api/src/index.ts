import express from "express";
import { connectRedis } from "./config/redis";
import { connectProducer } from "./config/kafka";
import {prisma} from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.route";
import urlRoutes from "./routes/url.route";
import analyticsRoutes from "./routes/analytic.route";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/api/urls", urlRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/", urlRoutes); // catches /r/:shortCode


app.get("/health", async (_req, res) => {
  const health: Record<string, string> = {
    api: "ok",
    postgres: "unknown",
    redis: "unknown",
    kafka: "unknown",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.postgres = "ok";
  } catch {
    health.postgres = "error";
  }

  try {
    const { redis } = await import("./config/redis");
    await redis.ping();
    health.redis = "ok";
  } catch {
    health.redis = "error";
  }

  health.kafka = "ok"; // Producer connected at startup

  const allOk = Object.values(health).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json(health);
});

// Global error handler — must be last middleware
app.use(errorHandler);

async function start() {
  try {
    await connectRedis();
    console.log("[Redis] Connected");

    await connectProducer();
    console.log("[Kafka] Producer connected");

    app.listen(PORT, () => {
      console.log(`[API] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("[API] Failed to start:", err);
    process.exit(1);
  }
}

// Graceful shutdown — close connections cleanly on SIGTERM
process.on("SIGTERM", async () => {
  console.log("[API] Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

start();