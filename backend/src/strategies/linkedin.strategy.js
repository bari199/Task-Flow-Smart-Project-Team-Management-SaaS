import { Strategy as LinkedInStrategy } from "passport-linkedin-oauth2";
import { resolveOAuthUser } from "../services/oauth.service.js";

export const registerLinkedInStrategy = (passport) => {
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    return false;
  }

  passport.use(
    "linkedin",
    new LinkedInStrategy(
      {
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/v1/auth/linkedin/callback`,
        scope: ["openid", "profile", "email"],
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          done(null, await resolveOAuthUser("linkedin", profile));
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  return true;
};
