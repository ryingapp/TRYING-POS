import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { wsManager } from "./websocket";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const app = express();
app.set('trust proxy', 1); // Trust first proxy (nginx)
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for SPA compatibility
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow same-origin requests (no origin header)
    if (!origin) return callback(null, true);
    
    // In dev mode allow all
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin) return callback(null, true);
    
    // Allow configured origins, their http/https variants, IP, and subdomains
    const allowed = [
      corsOrigin,
      corsOrigin.replace("https://", "http://"),
      `http://72.62.40.134:5000`,
      `http://72.62.40.134`,
      `https://72.62.40.134`,
    ];
    if (allowed.includes(origin) || origin.endsWith("." + corsOrigin.replace(/^https?:\/\//, ""))) {
      return callback(null, origin);
    }
    // Allow for flexibility - log but don't block
    console.warn(`CORS: allowing unlisted origin ${origin}`);
    return callback(null, true);
  },
  credentials: true,
}));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable validation for proxy compatibility
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute (increased for multi-device POS operations)
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Disable validation for proxy compatibility
});

app.use("/api/auth/login", authLimiter);
app.use("/api/users/register", authLimiter);
app.use("/api/", apiLimiter);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  
  // Initialize WebSocket server
  wsManager.initialize(httpServer);
  
  // Seed database with initial data
  await seedDatabase();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
