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
import { config } from "./app";
import { prisma } from "./prisma";
import type { User } from "@prisma/client";
import { logger } from "../helpers/logger";
import { handleGithubAuth, handleGoogleAuth } from "../services/OauthService";
import { AUTH_PROVIDERS } from "../constants/common";

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google Strategy
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
        const state = req.query["state"]
          ? JSON.parse(req.query["state"] as string)
          : {};
        const service = state.service;

        if (!service) {
          return done(new Error("Missing service in OAuth state"), undefined);
        }

        const user = await handleGoogleAuth(
          profile,
          AUTH_PROVIDERS.GOOGLE,
          service
        );
        return done(null, user);
      } catch (error) {
        logger.error("Google authentication error", { error, profile });
        return done(error as Error, undefined);
      }
    }
  )
);

// GitHub Strategy
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
      done: (error: Error | null, user?: User) => void
    ) => {
      try {
        const state = req.query["state"]
          ? JSON.parse(req.query["state"] as string)
          : {};
        const service = state.service;

        if (!service) {
          return done(new Error("Missing service in OAuth state"), undefined);
        }

        const user = await handleGithubAuth(profile, accessToken, service);
        return done(null, user);
      } catch (error) {
        logger.error("GitHub authentication error", { error, profile });
        return done(error as Error, undefined);
      }
    }
  )
);

export default passport;
