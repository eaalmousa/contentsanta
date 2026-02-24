import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { authenticateUser, findUserById, findOrCreateGoogleUser } from "../services/auth-service";
import type { User } from "@shared/models/auth";

// Serialize user for session - handle both custom auth and Replit auth
passport.serializeUser((user: any, done) => {
  // If user has claims (Replit auth), serialize the whole object
  if (user.claims) {
    done(null, user);
  } else {
    // Custom auth - just serialize user ID
    done(null, { id: user.id, authType: 'custom' });
  }
});

// Deserialize user from session - handle both formats
passport.deserializeUser(async (serialized: any, done) => {
  try {
    // If it's a Replit auth user (has claims), return as-is
    if (serialized.claims) {
      return done(null, serialized);
    }
    
    // If it's custom auth, fetch user from database
    if (serialized.id || serialized.authType === 'custom') {
      const userId = serialized.id || serialized;
      const user = await findUserById(userId);
      return done(null, user);
    }
    
    // Fallback - try to fetch by ID
    const user = await findUserById(serialized);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Local Strategy (Email/Password)
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await authenticateUser({ email, password });
        
        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL || "http://localhost:5000"}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

export default passport;
