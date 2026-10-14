import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { resolveOAuthUser } from "../services/oauth.service.js";

export const registerGoogleStrategy = (passport) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return false;
  }

  passport.use(
    "google",
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/v1/auth/google/callback`,
        scope: ["profile", "email"],
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          done(null, await resolveOAuthUser("google", profile));
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  return true;
};
