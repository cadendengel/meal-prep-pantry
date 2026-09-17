import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The transport is never really opened. These tests cover configuration
// detection, the unconfigured fallback, the From header and error mapping.
const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}));

const ENV_KEYS = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM_NAME'];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  vi.resetModules();
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

const load = () => import('../mailer.js');
const message = { to: 'ada@example.com', subject: 'Reset', text: 'link' };

describe('isMailConfigured', () => {
  it('is false when nothing is set', async () => {
    const { isMailConfigured } = await load();
    expect(isMailConfigured()).toBe(false);
  });

  it('is false when only the user is set', async () => {
    process.env.GMAIL_USER = 'a@gmail.com';
    const { isMailConfigured } = await load();
    expect(isMailConfigured()).toBe(false);
  });

  it('is false when only the password is set', async () => {
    process.env.GMAIL_APP_PASSWORD = 'abcdefghijklmnop';
    const { isMailConfigured } = await load();
    expect(isMailConfigured()).toBe(false);
  });

  it('is true when both are set', async () => {
    process.env.GMAIL_USER = 'a@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcdefghijklmnop';
    const { isMailConfigured } = await load();
    expect(isMailConfigured()).toBe(true);
  });

  it('accepts the spaced form Google displays', async () => {
    process.env.GMAIL_USER = 'a@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    const { isMailConfigured } = await load();
    expect(isMailConfigured()).toBe(true);
  });

  it('treats a whitespace-only password as unset', async () => {
    process.env.GMAIL_USER = 'a@gmail.com';
    process.env.GMAIL_APP_PASSWORD = '    ';
    const { isMailConfigured } = await load();
    expect(isMailConfigured()).toBe(false);
  });
});

describe('sendMail when unconfigured', () => {
  it('reports not_configured and never opens a transport', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMail } = await load();
    const result = await sendMail(message);

    expect(result).toEqual({ sent: false, reason: 'not_configured' });
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('logs the body, so a local reset link is recoverable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMail } = await load();
    await sendMail({ ...message, text: 'https://x.test/reset?token=abc' });
    expect(warn.mock.calls[0][0]).toContain('https://x.test/reset?token=abc');
  });
});

describe('sendMail when configured', () => {
  beforeEach(() => {
    process.env.GMAIL_USER = 'mealpreppantry@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
  });

  it('sends and reports success', async () => {
    sendMailMock.mockResolvedValue({ messageId: '<id@gmail>' });
    const { sendMail } = await load();
    const result = await sendMail(message);

    expect(result.sent).toBe(true);
    expect(result.messageId).toBe('<id@gmail>');
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('strips spaces from the password before authenticating', async () => {
    sendMailMock.mockResolvedValue({ messageId: '1' });
    const { sendMail } = await load();
    await sendMail(message);
    expect(createTransportMock.mock.calls[0][0].auth.pass).toBe('abcdefghijklmnop');
  });

  it('uses a secure connection to Gmail', async () => {
    sendMailMock.mockResolvedValue({ messageId: '1' });
    const { sendMail } = await load();
    await sendMail(message);
    const config = createTransportMock.mock.calls[0][0];
    expect(config.host).toBe('smtp.gmail.com');
    expect(config.port).toBe(465);
    expect(config.secure).toBe(true);
  });

  it('sends from the authenticated account with a default display name', async () => {
    sendMailMock.mockResolvedValue({ messageId: '1' });
    const { sendMail } = await load();
    await sendMail(message);
    expect(sendMailMock.mock.calls[0][0].from)
      .toBe('Meal Prep Pantry <mealpreppantry@gmail.com>');
  });

  it('honours a custom display name', async () => {
    process.env.MAIL_FROM_NAME = 'Pantry Bot';
    sendMailMock.mockResolvedValue({ messageId: '1' });
    const { sendMail } = await load();
    await sendMail(message);
    expect(sendMailMock.mock.calls[0][0].from)
      .toBe('Pantry Bot <mealpreppantry@gmail.com>');
  });

  it('reuses one transport across sends', async () => {
    sendMailMock.mockResolvedValue({ messageId: '1' });
    const { sendMail } = await load();
    await sendMail(message);
    await sendMail(message);
    expect(createTransportMock).toHaveBeenCalledTimes(1);
  });

  it('maps a rejected credential to auth_failed without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Invalid login');
    error.code = 'EAUTH';
    sendMailMock.mockRejectedValue(error);

    const { sendMail } = await load();
    const result = await sendMail(message);
    expect(result).toEqual({ sent: false, reason: 'auth_failed' });
  });

  it('reports other failures without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('connection timed out');
    error.code = 'ETIMEDOUT';
    sendMailMock.mockRejectedValue(error);

    const { sendMail } = await load();
    const result = await sendMail(message);
    expect(result).toEqual({ sent: false, reason: 'ETIMEDOUT' });
  });

  it('rebuilds the transport after a non-auth failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'ESOCKET' }));
    sendMailMock.mockResolvedValueOnce({ messageId: '2' });

    const { sendMail } = await load();
    await sendMail(message);
    await sendMail(message);
    expect(createTransportMock).toHaveBeenCalledTimes(2);
  });
});
