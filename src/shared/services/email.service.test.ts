import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createTransportMock, getConfigMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  getConfigMock: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

vi.mock('../config/index.js', () => ({
  getConfig: getConfigMock,
}));

import { sendEmail } from './email.service.js';

type MockEmailConfig = {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  from: string;
  to: string[];
};

type MockConfig = {
  username?: string;
  password?: string;
  email?: MockEmailConfig;
  headed: boolean;
  ci: boolean;
};

function buildBaseConfig(overrides: Partial<MockConfig> = {}): MockConfig {
  return {
    username: 'user',
    password: 'pass',
    headed: false,
    ci: false,
    ...overrides,
  };
}

describe('shared/services/email.service', () => {
  beforeEach(() => {
    createTransportMock.mockReset();
    getConfigMock.mockReset();
  });

  it('returns structured EMAIL_SEND_FAILED when email config is missing', async () => {
    getConfigMock.mockReturnValue(buildBaseConfig({ email: undefined }));

    const result = await sendEmail({
      subject: 'subject',
      html: '<p>body</p>',
      text: 'body',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('이메일 설정 없음');
    expect(result.errorCode).toBe('EMAIL_SEND_FAILED');
    expect(result.errorCategory).toBe('EMAIL');
  });

  it('returns structured EMAIL_SEND_FAILED when smtp send throws', async () => {
    const sendMailMock = vi.fn().mockRejectedValue(new Error('Invalid login: auth failed'));
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });

    getConfigMock.mockReturnValue(
      buildBaseConfig({
        email: {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          username: 'mailer',
          password: 'secret',
          from: 'sender@example.com',
          to: ['receiver@example.com'],
        },
      })
    );

    const result = await sendEmail({
      subject: 'subject',
      html: '<p>body</p>',
      text: 'body',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('auth failed');
    expect(result.errorCode).toBe('EMAIL_SEND_FAILED');
    expect(result.errorCategory).toBe('EMAIL');
  });

  it('should_apply_partial_attachment_policy_when_total_size_exceeds_limit', async () => {
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'message-id' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });

    getConfigMock.mockReturnValue(
      buildBaseConfig({
        email: {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          username: 'mailer',
          password: 'secret',
          from: 'sender@example.com',
          to: ['receiver@example.com'],
        },
      })
    );

    const attachmentA = Buffer.alloc(6 * 1024 * 1024, 1);
    const attachmentB = Buffer.alloc(6 * 1024 * 1024, 2);

    const result = await sendEmail({
      subject: 'subject',
      html: '<p>body</p>',
      text: 'body',
      attachments: [
        { filename: 'a.png', content: attachmentA, contentType: 'image/png' },
        { filename: 'b.html', content: attachmentB, contentType: 'text/html' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.attachmentStatus).toBe('PARTIAL');
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const sendMailPayload = sendMailMock.mock.calls[0][0] as {
      attachments?: Array<{ filename: string }>;
    };

    expect(sendMailPayload.attachments).toBeDefined();
    expect(sendMailPayload.attachments?.length).toBe(1);
    expect(sendMailPayload.attachments?.[0].filename).toBe('a.png');
  });
});
