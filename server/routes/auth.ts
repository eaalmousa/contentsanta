import { Router } from "express";
import passport from "../config/passport";
import { createUser } from "../services/auth-service";
import type { Request, Response, NextFunction } from "express";

const router = Router();

/**
 * POST /api/auth/signup
 * Create new account with email/password
 */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email and password are required" });
    }
    
    // Create user
    const user = await createUser({ email, password, firstName, lastName });
    
    // Log user in automatically
    req.login(user, (err) => {
      if (err) {
        console.error("Auto-login after signup failed:", err);
        return res.status(500).json({ ok: false, error: "Account created but login failed" });
      }
      
      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;
      
      res.json({ ok: true, user: userWithoutPassword });
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    
    if (error.message === "EMAIL_EXISTS") {
      return res.status(400).json({ ok: false, error: "Email already registered" });
    }
    
    if (error.message === "PASSWORD_TOO_SHORT") {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
    }
    
    res.status(500).json({ ok: false, error: "Signup failed" });
  }
});

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({ ok: false, error: "Login failed" });
    }
    
    if (!user) {
      return res.status(401).json({ ok: false, error: info?.message || "Invalid email or password" });
    }
    
    req.login(user, (err) => {
      if (err) {
        console.error("Session creation failed:", err);
        return res.status(500).json({ ok: false, error: "Login failed" });
      }
      
      // Remove password hash from response
      const { passwordHash, ...userWithoutPassword } = user;
      
      res.json({ ok: true, user: userWithoutPassword });
    });
  })(req, res, next);
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/?error=auth_failed" }),
  (req: Request, res: Response) => {
    // Successful authentication, redirect to app
    res.redirect("/");
  }
);

/**
 * GET /api/auth/user
 * Get current user (existing endpoint - keep for compatibility)
 */
router.get("/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }
  
  const user = req.user as any;
  const { passwordHash, ...userWithoutPassword } = user;
  
  res.json(userWithoutPassword);
});

/**
 * POST /api/auth/logout
 * Logout current user
 */
router.post("/logout", (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ ok: false, error: "Logout failed" });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction failed:", err);
      }
      res.json({ ok: true });
    });
  });
});

export default router;
