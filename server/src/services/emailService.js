import { env, isDev } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Email sending is abstracted behind this one function so a real provider
 * (SES, SendGrid, Postmark, Nodemailer+SMTP) can be dropped in later
 * without touching authService or any caller. In development, "sending"
 * means logging the content — good enough to copy a verification/reset
 * link out of the server console while building without real infra.
 */
async function sendEmail({ to, subject, text }) {
  if (isDev) {
    logger.info(`📧 [dev email] to=${to} subject="${subject}"\n${text}`);
    return { delivered: false, simulated: true };
  }

  // Production wiring point: call the real provider's SDK/API here.
  logger.warn('sendEmail called in production with no email provider configured', { to, subject });
  return { delivered: false, simulated: true };
}

export const emailService = {
  async sendVerificationEmail(user, rawToken) {
    const link = `${env.CLIENT_URL}/verify-email/${rawToken}`;
    return sendEmail({
      to: user.email,
      subject: 'Verify your MarketSphere account',
      text: `Hi ${user.name}, verify your email: ${link}\nThis link expires in 24 hours.`,
    });
  },

  async sendPasswordResetEmail(user, rawToken) {
    const link = `${env.CLIENT_URL}/reset-password/${rawToken}`;
    return sendEmail({
      to: user.email,
      subject: 'Reset your MarketSphere password',
      text: `Hi ${user.name}, reset your password: ${link}\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    });
  },
};
