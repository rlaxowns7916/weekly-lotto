/**
 * 이메일 전송 서비스
 * Nodemailer를 사용한 SMTP 이메일 전송
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { stat } from 'node:fs/promises';
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
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

/**
 * 이메일 전송 결과
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  errorCategory?: string;
  attachmentStatus?: 'NONE' | 'FULL' | 'PARTIAL';
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type AttachmentCandidate = {
  attachment: EmailAttachment;
  size: number;
};

type AttachmentPolicyResult = {
  selected: EmailAttachment[];
  status: 'NONE' | 'FULL' | 'PARTIAL';
  totalSize: number;
  selectedSize: number;
};

async function getAttachmentSize(attachment: EmailAttachment): Promise<number> {
  if (typeof attachment.content === 'string') {
    return Buffer.byteLength(attachment.content, 'utf-8');
  }

  if (attachment.content instanceof Buffer) {
    return attachment.content.length;
  }

  if (attachment.path) {
    try {
      const fileStat = await stat(attachment.path);
      return fileStat.size;
    } catch {
      return 0;
    }
  }

  return 0;
}

async function applyAttachmentPolicy(
  attachments: EmailAttachment[] | undefined
): Promise<AttachmentPolicyResult> {
  if (!attachments || attachments.length === 0) {
    return {
      selected: [],
      status: 'NONE',
      totalSize: 0,
      selectedSize: 0,
    };
  }

  const candidates: AttachmentCandidate[] = [];
  let totalSize = 0;

  for (const attachment of attachments) {
    const size = await getAttachmentSize(attachment);
    candidates.push({ attachment, size });
    totalSize += size;
  }

  if (totalSize <= MAX_ATTACHMENT_BYTES) {
    return {
      selected: attachments,
      status: 'FULL',
      totalSize,
      selectedSize: totalSize,
    };
  }

  const selected: EmailAttachment[] = [];
  let selectedSize = 0;

  for (const candidate of candidates) {
    if (candidate.size <= 0) {
      continue;
    }

    if (selectedSize + candidate.size > MAX_ATTACHMENT_BYTES) {
      continue;
    }

    selected.push(candidate.attachment);
    selectedSize += candidate.size;
  }

  return {
    selected,
    status: 'PARTIAL',
    totalSize,
    selectedSize,
  };
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
  const attachmentPolicy = await applyAttachmentPolicy(options.attachments);

  if (!config.email) {
    console.warn('이메일 설정이 없습니다. 이메일을 전송하지 않습니다.');
    return {
      success: false,
      error: '이메일 설정 없음',
      errorCode: 'EMAIL_SEND_FAILED',
      errorCategory: 'EMAIL',
      attachmentStatus: attachmentPolicy.status,
    };
  }

  try {
    const transporter = createTransporter(config.email);

    if (attachmentPolicy.status === 'PARTIAL') {
      const droppedCount = (options.attachments?.length ?? 0) - attachmentPolicy.selected.length;
      console.warn(
        `첨부 용량 상한(10MB) 적용: selected=${attachmentPolicy.selected.length}, dropped=${droppedCount}, totalBytes=${attachmentPolicy.totalSize}, selectedBytes=${attachmentPolicy.selectedSize}`
      );
    }

    const info = await transporter.sendMail({
      from: config.email.from,
      to: config.email.to.join(', '),
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: attachmentPolicy.selected.length > 0 ? attachmentPolicy.selected : undefined,
    });

    console.log(`이메일 전송 성공: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      attachmentStatus: attachmentPolicy.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`이메일 전송 실패: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      errorCode: 'EMAIL_SEND_FAILED',
      errorCategory: 'EMAIL',
      attachmentStatus: attachmentPolicy.status,
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
