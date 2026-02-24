import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import type { User } from "@shared/models/auth";
import { authStorage } from "../replit_integrations/auth/storage";

export interface SignupData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user with email/password
 */
export async function createUser(data: SignupData): Promise<User> {
  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  
  if (existing.length > 0) {
    throw new Error("EMAIL_EXISTS");
  }
  
  // Validate password strength
  if (data.password.length < 8) {
    throw new Error("PASSWORD_TOO_SHORT");
  }
  
  // Hash password
  const passwordHash = await hashPassword(data.password);
  
  // Create user
  const [newUser] = await db.insert(users).values({
    email: data.email,
    passwordHash,
    authProvider: "email",
    firstName: data.firstName || null,
    lastName: data.lastName || null,
  }).returning();
  
  // Ensure user has a workspace (same as Replit auth flow)
  try {
    await authStorage.ensureUserHasWorkspace(newUser.id, newUser.email || "");
  } catch (error) {
    console.error("[Auth] Failed to create workspace for user:", error);
    // Don't fail signup if workspace creation fails
  }
  
  return newUser;
}

/**
 * Authenticate user with email/password
 */
export async function authenticateUser(data: LoginData): Promise<User | null> {
  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  
  if (!user || !user.passwordHash) {
    return null;
  }
  
  // Verify password
  const isValid = await verifyPassword(data.password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }
  
  return user;
}

/**
 * Find or create user from Google OAuth
 */
export async function findOrCreateGoogleUser(profile: any): Promise<User> {
  const email = profile.emails[0].value;
  const googleId = profile.id;
  
  // Check if user exists by Google ID
  let [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  
  if (user) {
    return user;
  }
  
  // Check if user exists by email (link accounts)
  [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (user) {
    // Link Google account to existing user
    const [updated] = await db.update(users)
      .set({ 
        googleId, 
        authProvider: "google",
        profileImageUrl: profile.photos?.[0]?.value || user.profileImageUrl,
      })
      .where(eq(users.id, user.id))
      .returning();
    
    return updated;
  }
  
  // Create new user from Google profile
  const [newUser] = await db.insert(users).values({
    email,
    googleId,
    authProvider: "google",
    firstName: profile.name?.givenName || null,
    lastName: profile.name?.familyName || null,
    profileImageUrl: profile.photos?.[0]?.value || null,
    emailVerified: new Date(), // Google emails are verified
  }).returning();
  
  // Ensure user has a workspace
  try {
    await authStorage.ensureUserHasWorkspace(newUser.id, newUser.email || "");
  } catch (error) {
    console.error("[Auth] Failed to create workspace for Google user:", error);
  }
  
  return newUser;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user || null;
}

/**
 * Update user profile
 */
export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  const [updated] = await db.update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  
  return updated;
}
