import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";

// Import custom passport strategies (local + Google OAuth)
import "../../config/passport";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // In development, use non-secure cookies for localhost
  const isProduction = process.env.NODE_ENV === "production";
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // Only secure in production (HTTPS)
      sameSite: isProduction ? "lax" : "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // STRICT PRODUCTION GUARD: Prevent dev bypass in production
  if (process.env.NODE_ENV === "production") {
    if (process.env.ALLOW_DEV_BYPASS === "true") {
      throw new Error("SECURITY VIOLATION: Dev bypass cannot be enabled in production (ALLOW_DEV_BYPASS=true)");
    }
    if (process.env.REPL_ID === "local-dev-test") {
      throw new Error("SECURITY VIOLATION: Production cannot use local-dev-test REPL_ID");
    }
  }

  // Development mode bypass for local testing
  // Requires THREE conditions: NODE_ENV=development, REPL_ID=local-dev-test, ALLOW_DEV_BYPASS=true
  if (process.env.NODE_ENV === "development" && 
      process.env.REPL_ID === "local-dev-test" &&
      process.env.ALLOW_DEV_BYPASS === "true") {
    
    console.warn("⚠️  DEV USER BYPASS ACTIVE - NOT FOR PRODUCTION");
    console.log("[Auth] Running in LOCAL DEVELOPMENT MODE - auth bypass enabled");
    
    // Generate unique dev user ID (can't be guessed)
    const devUserId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // NOTE: Do NOT override passport serialization here - it's handled in server/config/passport.ts
    // Custom auth (email/password/Google) needs its own serialization logic
    
    // Mock login endpoint for development
    app.get("/api/login", async (req, res) => {
      const mockUser = {
        claims: {
          sub: devUserId,
          email: "dev@localhost",
          name: "Development User",
          profile_image_url: null,
        },
        access_token: "dev-token",
        refresh_token: "dev-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      };
      
      console.log(`[Auth] Dev bypass: Created user ${devUserId}`);
      
      // Ensure development user and workspace exist (async, not awaited - don't block login)
      upsertUser(mockUser.claims)
        .then(async () => {
          const workspace = await authStorage.ensureUserHasWorkspace(
            mockUser.claims.sub,
            mockUser.claims.email
          );
          console.log("[Auth] Dev user authenticated, workspace:", workspace.slug, workspace.id);
        })
        .catch((error) => {
          console.error("[Auth] Error setting up dev user:", error);
        });
      
      // Immediately establish session and respond
      req.login(mockUser, (err) => {
        if (err) {
          console.error("[Auth] Login error:", err);
          return res.status(500).send("Login failed");
        }
        res.redirect("/");
      });
    });
    
    // Fast login endpoint for testing - returns JSON immediately
    app.get("/api/dev/session", async (req, res) => {
      const mockUser = {
        claims: {
          sub: devUserId,
          email: "dev@localhost",
          name: "Development User",
          profile_image_url: null,
        },
        access_token: "dev-token",
        refresh_token: "dev-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 86400,
      };
      
      // Ensure user exists in DB (quick upsert only, workspace creation is async)
      try {
        await upsertUser(mockUser.claims);
        
        // Async workspace setup (not awaited)
        authStorage.ensureUserHasWorkspace(mockUser.claims.sub, mockUser.claims.email)
          .catch((error) => console.error("[Auth] Async workspace setup error:", error));
        
        // Establish session immediately
        req.login(mockUser, (err) => {
          if (err) {
            console.error("[Auth] Session login error:", err);
            return res.status(500).json({ error: "Login failed" });
          }
          res.json({ ok: true, userId: mockUser.claims.sub });
        });
      } catch (error) {
        console.error("[Auth] Dev session error:", error);
        res.status(500).json({ error: "Failed to create session" });
      }
    });
    
    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect("/");
      });
    });
    
    app.get("/api/callback", (req, res) => {
      res.redirect("/api/login");
    });
    
    return; // Skip Replit OAuth setup in dev mode
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  const path = req.path;
  const method = req.method;

  if (!req.isAuthenticated()) {
    console.log(`[Auth] 401 - not authenticated: ${method} ${path}`);
    return res.status(401).json({ message: "Unauthorized", reason: "not_authenticated" });
  }
  
  // ✅ FIX: Handle both custom auth (email/password/Google) and Replit OIDC auth
  // Custom auth: user has 'id' field directly
  // Replit auth: user has 'claims' and 'expires_at'
  
  // If custom auth (has user.id but no expires_at), allow immediately
  if (user?.id && !user?.expires_at) {
    console.log(`[Auth] ✅ Custom auth verified: ${method} ${path} (user: ${user.id})`);
    return next();
  }
  
  // Replit OIDC auth - check token expiration
  if (!user?.expires_at) {
    console.log(`[Auth] 401 - no expires_at in session: ${method} ${path}`);
    return res.status(401).json({ message: "Unauthorized", reason: "no_session_expiry" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    console.log(`[Auth] ✅ Replit OIDC token valid: ${method} ${path}`);
    return next();
  }

  console.log(`[Auth] Token expired, attempting refresh: ${method} ${path}`);
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log(`[Auth] 401 - no refresh token available: ${method} ${path}`);
    res.status(401).json({ message: "Unauthorized", reason: "no_refresh_token" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    console.log(`[Auth] Token refreshed successfully: ${method} ${path}`);
    return next();
  } catch (error: any) {
    console.log(`[Auth] 401 - token refresh failed: ${method} ${path}`, error?.message || error);
    res.status(401).json({ message: "Unauthorized", reason: "refresh_failed" });
    return;
  }
};

// Automation key utilities for server-to-server auth
export async function generateAutomationKey(): Promise<{ raw: string; hash: string; last4: string }> {
  const { randomBytes } = await import("crypto");
  const raw = `cs_auto_${randomBytes(32).toString("base64url")}`;
  const hash = await bcrypt.hash(raw, 10);
  const last4 = raw.slice(-4);
  return { raw, hash, last4 };
}

export async function verifyAutomationKey(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash);
}

// Middleware that accepts either user session OR automation key
export function createAutomationAuthMiddleware(
  getWorkspaceFromRequest: (req: Request) => Promise<{ automationKeyHash: string | null; id: string } | null>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const method = req.method;
    
    // Check for automation key header first
    const automationKey = req.headers["x-contentsanta-automation-key"] as string;
    if (automationKey) {
      console.log(`[Auth] Automation key auth attempt: ${method} ${path}`);
      const workspace = await getWorkspaceFromRequest(req);
      
      if (!workspace) {
        console.log(`[Auth] 401 - workspace not found for automation key: ${method} ${path}`);
        return res.status(401).json({ message: "Unauthorized", reason: "workspace_not_found" });
      }
      
      if (!workspace.automationKeyHash) {
        console.log(`[Auth] 401 - no automation key configured: ${method} ${path}`);
        return res.status(401).json({ message: "Unauthorized", reason: "no_automation_key" });
      }
      
      const valid = await verifyAutomationKey(automationKey, workspace.automationKeyHash);
      if (!valid) {
        console.log(`[Auth] 401 - invalid automation key: ${method} ${path}`);
        return res.status(401).json({ message: "Unauthorized", reason: "invalid_automation_key" });
      }
      
      console.log(`[Auth] Automation key verified for workspace: ${workspace.id}`);
      // Mark request as automation-authenticated
      (req as any).automationAuth = { workspaceId: workspace.id };
      return next();
    }
    
    // Fall back to user session auth
    return isAuthenticated(req, res, next);
  };
}
