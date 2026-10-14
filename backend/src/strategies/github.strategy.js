import GitHubStrategy from "passport-github2";
import { resolveOAuthUser } from "../services/oauth.service.js";

export function registerGitHubStrategy(passport) {
  const clientID = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.log("OAuth provider disabled: github");
    return false;
  }

  passport.use(
    "github",
    new GitHubStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: `${process.env.BACKEND_URL}/api/v1/auth/github/callback`,
        scope: ["user:email"],
        state: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await resolveOAuthUser("github", profile);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  console.log("OAuth provider configured: github 1");
  return true;
}
