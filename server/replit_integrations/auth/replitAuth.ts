import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";

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
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
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
  
  if (!user?.expires_at) {
    console.log(`[Auth] 401 - no expires_at in session: ${method} ${path}`);
    return res.status(401).json({ message: "Unauthorized", reason: "no_session_expiry" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
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
