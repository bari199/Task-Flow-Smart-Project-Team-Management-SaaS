import { Strategy as FacebookStrategy } from "passport-facebook";
import { resolveOAuthUser } from "../services/oauth.service.js";

export const registerFacebookStrategy = (passport) => {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return false;
  }

  passport.use(
    "facebook",
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/v1/auth/facebook/callback`,
        profileFields: ["id", "displayName", "emails", "photos"],
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          done(null, await resolveOAuthUser("facebook", profile));
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  return true;
};
