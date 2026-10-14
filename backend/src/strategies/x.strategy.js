import { Strategy as TwitterStrategy } from "passport-twitter";
import { resolveOAuthUser } from "../services/oauth.service.js";

export const registerXStrategy = (passport) => {
  if (!process.env.X_CONSUMER_KEY || !process.env.X_CONSUMER_SECRET) {
    return false;
  }

  passport.use(
    "twitter",
    new TwitterStrategy(
      {
        consumerKey: process.env.X_CONSUMER_KEY,
        consumerSecret: process.env.X_CONSUMER_SECRET,
        callbackURL: `${process.env.BACKEND_URL}/api/v1/auth/x/callback`,
        includeEmail: true,
      },
      async (token, tokenSecret, profile, done) => {
        try {
          done(null, await resolveOAuthUser("x", profile));
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  return true;
};
