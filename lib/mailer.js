import nodemailer from 'nodemailer';

/**
 * Outbound email through Gmail SMTP.
 *
 * Gmail is used rather than an API provider because it lets the app send
 * as a real Gmail address. API providers require DNS verification of the
 * sending domain, which is impossible for gmail.com.
 *
 * Authentication uses a Google App Password, not the account password.
 * The account needs 2-Step Verification enabled to create one.
 *
 * When GMAIL_USER or GMAIL_APP_PASSWORD is absent the mailer logs the
 * message and reports that it did not send. Local development then works
 * without credentials, and missing configuration is visible in the logs
 * rather than silent.
 */

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;

// Gmail caps a free account at roughly 500 recipients per day. Password
// resets sit far below that.
const TIMEOUT_MS = 10000;

// Reused across warm invocations, so one connection is not rebuilt per call.
let transporter = null;

/**
 * Read the app password, ignoring the spaces Google shows it with.
 *
 * Google displays app passwords as four groups of four ("abcd efgh ijkl
 * mnop"). Pasting that verbatim is the normal case, and the spaces are
 * not part of the secret.
 *
 * @returns {string} The password with whitespace removed
 */
function readAppPassword() {
  return (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
}

/**
 * Report whether real delivery is configured.
 *
 * @returns {boolean} True when a Gmail account and app password are set
 */
export function isMailConfigured() {
  return Boolean(process.env.GMAIL_USER && readAppPassword());
}

/**
 * Build the address messages are sent from.
 *
 * Gmail sends as the authenticated account, so the address always matches
 * GMAIL_USER. MAIL_FROM sets only the display name shown to the reader.
 *
 * @returns {string} An RFC 5322 from header value
 */
function buildFrom() {
  const address = process.env.GMAIL_USER;
  const name = process.env.MAIL_FROM_NAME || 'Meal Prep Pantry';
  return `${name} <${address}>`;
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: readAppPassword(),
      },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }
  return transporter;
}

/**
 * Send one email.
 *
 * Never throws. A failure is reported through the return value, so a
 * caller such as the password reset endpoint can stay generic.
 *
 * @param {{to: string, subject: string, text: string}} message - Message to send
 * @returns {Promise<{sent: boolean, reason?: string}>} Delivery outcome
 */
export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) {
    console.warn(
      '[mailer] GMAIL_USER or GMAIL_APP_PASSWORD is not set. Email was not sent.\n' +
      `  to: ${to}\n  subject: ${subject}\n  body:\n${text}`
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: buildFrom(),
      to,
      subject,
      text,
    });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    // A bad app password reports EAUTH. Google also rejects the account
    // password itself, which is the usual first mistake.
    if (error?.code === 'EAUTH') {
      console.error(
        '[mailer] Gmail rejected the credentials. Check that GMAIL_APP_PASSWORD ' +
        'is a 16-character App Password, not the account password, and that ' +
        '2-Step Verification is enabled.',
        error.message
      );
      return { sent: false, reason: 'auth_failed' };
    }

    console.error('[mailer] send failed:', error);
    // The transport may be in a bad state, so it is rebuilt next time.
    transporter = null;
    return { sent: false, reason: error?.code || 'send_error' };
  }
}
