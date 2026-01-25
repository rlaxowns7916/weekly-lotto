/**
 * 이메일 전송 서비스
 * Nodemailer를 사용한 SMTP 이메일 전송
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailConfig } from '../config/index.js';
import { getConfig } from '../config/index.js';

/**
 * 이메일 전송 옵션
 */
export interface EmailOptions {
  /** 이메일 제목 */
  subject: string;
  /** HTML 본문 */
  html: string;
  /** 텍스트 본문 (HTML 미지원 클라이언트용) */
  text?: string;
}

/**
 * 이메일 전송 결과
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Nodemailer 트랜스포터 생성
 */
function createTransporter(config: NonNullable<EmailConfig>): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
}

/**
 * 이메일 전송
 *
 * @param options 이메일 옵션 (subject, html, text)
 * @returns 전송 결과
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const config = getConfig();

  if (!config.email) {
    console.warn('이메일 설정이 없습니다. 이메일을 전송하지 않습니다.');
    return {
      success: false,
      error: '이메일 설정 없음',
    };
  }

  try {
    const transporter = createTransporter(config.email);

    const info = await transporter.sendMail({
      from: config.email.from,
      to: config.email.to.join(', '),
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`이메일 전송 성공: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`이메일 전송 실패: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 이메일 설정이 유효한지 확인
 */
export function hasEmailConfig(): boolean {
  const config = getConfig();
  return config.email !== undefined;
}
