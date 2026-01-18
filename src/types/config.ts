export interface IConfig {
  port: number;
  nodeEnv: string;
  cors: string[];
  logLevel: string;
  version: string;
  app: {
    name: string;
    url: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  security: {
    bcryptRounds: number;
    maxLoginAttempts: number;
    loginLockTime: number;
    maxRegistrationAttempts: number;
    registrationLockTime: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  discordAlert: string;
  postgresqlUrl: string;
  oauth: {
    google: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
    github: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  };
}
