import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { resolveWorkspace } from "../replit_integrations/auth";

/**
 * RBAC middleware - Require specific workspace roles
 * Usage: app.post("/api/resource", isAuthenticated, requireRole(["admin", "owner"]), handler)
 */
export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ 
          error: "Unauthorized",
          message: "Authentication required"
        });
      }

      // Get user's active workspace
      const workspace = await resolveWorkspace(userId);
      
      // Get user's role in this workspace
      const memberships = await storage.getUserWorkspaceMemberships(userId);
      const membership = memberships.find(m => m.workspaceId === workspace.id);
      
      if (!membership) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Not a member of this workspace",
          requiredRoles: allowedRoles
        });
      }

      // Check if user's role is allowed
      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Insufficient permissions for this action",
          requiredRoles: allowedRoles,
          userRole: membership.role
        });
      }

      // Attach workspace info to request for downstream use
      (req as any).workspace = workspace;
      (req as any).userRole = membership.role;
      
      next();
    } catch (error: any) {
      console.error("[RBAC] Error checking permissions:", error);
      res.status(500).json({ 
        error: "Internal server error",
        message: "Failed to verify permissions"
      });
    }
  };
}

/**
 * Verify resource belongs to user's workspace
 * Usage: await requireWorkspaceOwnership(resource.workspaceId, userId)
 */
export async function requireWorkspaceOwnership(
  resourceWorkspaceId: string,
  userId: string
): Promise<{ allowed: boolean; workspace?: any }> {
  try {
    const workspace = await resolveWorkspace(userId);
    
    if (resourceWorkspaceId !== workspace.id) {
      return { allowed: false };
    }
    
    return { allowed: true, workspace };
  } catch (error) {
    return { allowed: false };
  }
}
