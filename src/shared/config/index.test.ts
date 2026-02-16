import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('shared/config/index', () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('parses base config and boolean flags', async () => {
    process.env.LOTTO_USERNAME = 'user';
    process.env.LOTTO_PASSWORD = 'pass';
    process.env.HEADED = 'true';
    process.env.CI = 'false';

    const { getConfig } = await import('./index.js');
    const config = getConfig();

    expect(config.username).toBe('user');
    expect(config.password).toBe('pass');
    expect(config.headed).toBe(true);
    expect(config.ci).toBe(false);
    expect(config.email).toBeUndefined();
  });

  it('enables email config only when full email fields are valid', async () => {
    process.env.LOTTO_EMAIL_SMTP_HOST = 'smtp.gmail.com';
    process.env.LOTTO_EMAIL_SMTP_PORT = '587';
    process.env.LOTTO_EMAIL_USERNAME = 'sender@gmail.com';
    process.env.LOTTO_EMAIL_PASSWORD = 'secret';
    process.env.LOTTO_EMAIL_FROM = 'sender@gmail.com';
    process.env.LOTTO_EMAIL_TO = 'a@gmail.com, b@gmail.com';

    const { getConfig } = await import('./index.js');
    const config = getConfig();

    expect(config.email).toBeDefined();
    expect(config.email?.smtpHost).toBe('smtp.gmail.com');
    expect(config.email?.smtpPort).toBe(587);
    expect(config.email?.to).toEqual(['a@gmail.com', 'b@gmail.com']);
  });

  it('throws when smtp host/port exist but required email fields are missing', async () => {
    process.env.LOTTO_EMAIL_SMTP_HOST = 'smtp.gmail.com';
    process.env.LOTTO_EMAIL_SMTP_PORT = '587';

    const { getConfig } = await import('./index.js');

    expect(() => getConfig()).toThrow();
  });

  it('caches loaded config as singleton', async () => {
    process.env.LOTTO_USERNAME = 'first-user';
    process.env.LOTTO_PASSWORD = 'first-pass';

    const { getConfig } = await import('./index.js');
    const first = getConfig();

    process.env.LOTTO_USERNAME = 'second-user';
    const second = getConfig();

    expect(first.username).toBe('first-user');
    expect(second.username).toBe('first-user');
  });
});
