import passport from "passport";
import type { Request } from "express";
import {
  Strategy as GoogleStrategy,
  type Profile as GoogleProfile,
  type VerifyCallback,
} from "passport-google-oauth20";
import {
  Strategy as GitHubStrategy,
  type Profile as GitHubProfile,
} from "passport-github2";
import { prisma } from "./prisma";
import { logger } from "../helpers/logger";
import { handleGithubAuth, handleGoogleAuth } from "../services/OauthService";
import { AUTH_PROVIDERS } from "../constants/common";
import type { User } from "@prisma/client";
import { config } from "./app";

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user as User | null);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Register Google OAuth strategy for a specific service
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: config.oauth.google.callbackUrl,
      passReqToCallback: true,
    },
    async (
      req: Request,
      accessToken: string,
      refreshToken: string,
      profile: GoogleProfile,
      done: VerifyCallback
    ) => {
      try {
        const user = await handleGoogleAuth(profile, AUTH_PROVIDERS.GOOGLE);
        return done(null, user);
      } catch (error) {
        logger.error("Google authentication error", {
          error,
          profile,
        });
        return done(error as Error, undefined);
      }
    }
  )
);

/**
 * Register GitHub OAuth strategy for a specific service
 */
passport.use(
  new GitHubStrategy(
    {
      clientID: config.oauth.github.clientId,
      clientSecret: config.oauth.github.clientSecret,
      callbackURL: config.oauth.github.callbackUrl,
      passReqToCallback: true,
    },
    async (
      req: Request,
      accessToken: string,
      refreshToken: string,
      profile: GitHubProfile,
      done: VerifyCallback
    ) => {
      try {
        const user = await handleGithubAuth(profile, accessToken);
        return done(null, user);
      } catch (error) {
        logger.error("GitHub authentication error", {
          error,
          profile,
        });
        return done(error as Error, undefined);
      }
    }
  )
);