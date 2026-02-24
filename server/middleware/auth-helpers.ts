import type { Request } from "express";

/**
 * Extract user ID from request - works with both Replit auth and custom auth
 */
export function getUserId(req: Request): string | null {
  if (!req.user) {
    return null;
  }
  
  const user = req.user as any;
  
  // Replit auth: user has claims.sub
  if (user.claims && user.claims.sub) {
    return user.claims.sub;
  }
  
  // Custom auth: user has id directly
  if (user.id) {
    return user.id;
  }
  
  return null;
}

/**
 * Extract user email from request - works with both Replit auth and custom auth
 */
export function getUserEmail(req: Request): string | null {
  if (!req.user) {
    return null;
  }
  
  const user = req.user as any;
  
  // Replit auth: user has claims.email
  if (user.claims && user.claims.email) {
    return user.claims.email;
  }
  
  // Custom auth: user has email directly
  if (user.email) {
    return user.email;
  }
  
  return null;
}

/**
 * Require authentication - works with both auth types
 */
export function requireUserId(req: Request): string {
  const userId = getUserId(req);
  
  if (!userId) {
    throw new Error("Not authenticated");
  }
  
  return userId;
}
