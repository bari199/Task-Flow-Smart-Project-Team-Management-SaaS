import { Router } from "express";
import passport from "passport";

import { enabledOAuthProviders } from "../config/passport.js";

const router = Router();

const providerStrategies = {
  google: "google",
  linkedin: "linkedin",
  facebook: "facebook",
  github: "github",
  x: "twitter",
};

const isEnabled = (provider) => enabledOAuthProviders.has(provider);

const providerUnavailable = (res) =>
  res.status(503).json({
    success: false,
    message: "This OAuth provider is not configured",
  });

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";

const failRedirect = () => `${frontendUrl()}/login?error=oauth_failed`;

const successRedirect = (provider) =>
  `${frontendUrl()}/auth/callback?provider=${encodeURIComponent(provider)}`;

const completeOAuth = (provider) => (req, res, next) => {
  passport.authenticate(
    providerStrategies[provider],
    { session: false },
    (error, user) => {
      if (error || !user) {
        return res.redirect(failRedirect());
      }

      req.session.regenerate((sessionError) => {
        if (sessionError) return next(sessionError);

        req.session.userId = user.id;

        req.session.save((saveError) => {
          if (saveError) return next(saveError);

          res.redirect(successRedirect(provider));
        });
      });
    },
  )(req, res, next);
};

for (const provider of Object.keys(providerStrategies)) {
  router.get(`/${provider}`, (req, res, next) => {
    if (!isEnabled(provider)) return providerUnavailable(res);

    passport.authenticate(providerStrategies[provider], {
      session: false,
    })(req, res, next);
  });

  router.get(
    `/${provider}/callback`,
    (req, res, next) => {
      if (!isEnabled(provider)) return providerUnavailable(res);
      next();
    },
    completeOAuth(provider),
  );
}

export default router;
