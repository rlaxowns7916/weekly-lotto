/**
 * 환경 변수 설정 및 검증
 * Zod를 사용하여 런타임에 환경 변수 타입을 검증합니다.
 */

import { z } from 'zod';

/**
 * 이메일 설정 스키마 (선택적)
 */
const emailConfigSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1).transform((s) => s.split(',').map((e) => e.trim())),
}).optional();

/**
 * 전체 설정 스키마
 */
const configSchema = z.object({
  /** 동행복권 로그인 아이디 */
  username: z.string().min(1, 'LOTTO_USERNAME 필수'),
  /** 동행복권 로그인 비밀번호 */
  password: z.string().min(1, 'LOTTO_PASSWORD 필수'),
  /** 이메일 설정 (선택) */
  email: emailConfigSchema,
  /** 브라우저 표시 여부 (headed 모드) */
  headed: z.coerce.boolean().default(false),
  /** CI 환경 여부 */
  ci: z.coerce.boolean().default(false),
});

/**
 * 설정 타입
 */
export type Config = z.infer<typeof configSchema>;

/**
 * 이메일 설정 타입
 */
export type EmailConfig = z.infer<typeof emailConfigSchema>;

/**
 * 환경 변수에서 설정 로드
 * @throws {z.ZodError} 필수 환경 변수가 없거나 형식이 잘못된 경우
 */
export function loadConfig(): Config {
  // 이메일 설정이 모두 있는 경우에만 포함
  const hasEmailConfig = process.env.LOTTO_EMAIL_SMTP_HOST && process.env.LOTTO_EMAIL_SMTP_PORT;

  const result = configSchema.safeParse({
    username: process.env.LOTTO_USERNAME,
    password: process.env.LOTTO_PASSWORD,
    email: hasEmailConfig ? {
      smtpHost: process.env.LOTTO_EMAIL_SMTP_HOST,
      smtpPort: process.env.LOTTO_EMAIL_SMTP_PORT,
      username: process.env.LOTTO_EMAIL_USERNAME,
      password: process.env.LOTTO_EMAIL_PASSWORD,
      from: process.env.LOTTO_EMAIL_FROM,
      to: process.env.LOTTO_EMAIL_TO,
    } : undefined,
    headed: process.env.HEADED,
    ci: process.env.CI,
  });

  if (!result.success) {
    console.error('환경 변수 설정 오류:');
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join('.')}: ${error.message}`);
    }
    throw result.error;
  }

  return result.data;
}

/**
 * 설정 싱글톤 (lazy 로드)
 */
let _config: Config | null = null;

/**
 * 설정 가져오기 (캐시됨)
 */
export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * 설정 캐시 초기화 (테스트용)
 */
export function resetConfig(): void {
  _config = null;
}
