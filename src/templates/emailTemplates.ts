import { config } from "../config/app";
import { renderTemplate } from "../services/TemplateService";
import type { EmailTemplate } from "../types/email";

/**
 * Generate email verification template
 */
export const generateEmailVerificationTemplate = async (
  name: string,
  verificationToken: string,
  redirectUrl: string,
  isEmailChange: boolean = false
): Promise<EmailTemplate> => {
  const verificationUrl = `${redirectUrl}?token=${verificationToken}`;

  const message = isEmailChange
    ? `You have requested to change your email address. To complete this change, please verify your new email address by clicking the button below:`
    : `Thank you for registering with us. To complete your registration, please verify your email address by clicking the button below:`;

  const footerMessage = isEmailChange
    ? `If you didn't request this change, please ignore this email or contact support if you're concerned about your account security.`
    : `If you didn't create an account, please ignore this email.`;

  return await renderTemplate("email-verification", {
    subject: `${config.app.name} - Verify Your Email Address`,
    name,
    verificationUrl,
    message,
    footerMessage,
  });
};

/**
 * Generate password reset template
 */
export const generatePasswordResetTemplate = async (
  name: string,
  resetToken: string,
  redirectUrl: string
): Promise<EmailTemplate> => {
  const resetUrl = `${redirectUrl}?token=${resetToken}`;

  return await renderTemplate("password-reset", {
    subject: `${config.app.name} - Password Reset Request`,
    name,
    resetUrl,
  });
};
