import passport from "passport";

import { registerGoogleStrategy } from "../strategies/google.strategy.js";
import { registerLinkedInStrategy } from "../strategies/linkedin.strategy.js";
import { registerFacebookStrategy } from "../strategies/facebook.strategy.js";
import { registerGitHubStrategy } from "../strategies/github.strategy.js";
import { registerXStrategy } from "../strategies/x.strategy.js";

export const enabledOAuthProviders = new Set();

export const configurePassport = () => {
  const registrations = [
    ["google", registerGoogleStrategy],
    ["linkedin", registerLinkedInStrategy],
    ["facebook", registerFacebookStrategy],
    ["github", registerGitHubStrategy],
    ["x", registerXStrategy],
  ];

  for (const [name, register] of registrations) {
    if (register(passport)) {
      enabledOAuthProviders.add(name);
      console.log(`OAuth provider configured: ${name}`);
    } else {
      console.log(`OAuth provider disabled: ${name}`);
    }
  }

  return passport;
};
