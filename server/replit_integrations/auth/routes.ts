import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import authRoutes from "../../routes/auth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Register custom auth routes (email/password + Google OAuth)
  app.use("/api/auth", authRoutes);
  
  // Get current authenticated user (compatibility endpoint for Replit auth)
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // Check if user is authenticated (works with both Replit and custom auth)
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Handle Replit auth user format (has claims.sub)
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const user = await authStorage.getUser(userId);
        return res.json(user);
      }
      
      // Handle custom auth user format (direct user object)
      const { passwordHash, ...userWithoutPassword } = req.user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
