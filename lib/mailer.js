/**
 * Outbound email.
 *
 * No mail provider is configured by default. When RESEND_API_KEY is absent
 * the mailer logs the message and reports that it did not send. That keeps
 * local development working without credentials, and it makes the missing
 * configuration obvious in production logs rather than silent.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Report whether a real mail provider is configured.
 *
 * @returns {boolean} True when email can actually be delivered
 */
export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * Send one email.
 *
 * @param {{to: string, subject: string, text: string}} message - Message to send
 * @returns {Promise<{sent: boolean, reason?: string}>} Delivery outcome
 */
export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) {
    console.warn(
      '[mailer] RESEND_API_KEY or MAIL_FROM is not set. Email was not sent.\n' +
      `  to: ${to}\n  subject: ${subject}\n  body:\n${text}`
    );
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[mailer] provider rejected the message:', response.status, detail);
      return { sent: false, reason: `provider_error_${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error('[mailer] send failed:', error);
    return { sent: false, reason: 'network_error' };
  }
}
