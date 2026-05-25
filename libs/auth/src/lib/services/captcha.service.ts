import { AppLoggerService } from '@mediastar/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RecaptchaResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

@Injectable()
export class CaptchaService {
  private readonly secretKey: string;
  private readonly bypassVerification: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(CaptchaService.name);
    this.secretKey = this.config.getOrThrow<string>('app.recaptcha.secretKey');
    const nodeEnv = this.config.get<string>('app.nodeEnv', 'development');
    this.bypassVerification = nodeEnv === 'development' || nodeEnv === 'staging';
  }

  async verify(token: string, ip?: string): Promise<void> {
    if (this.bypassVerification) {
      this.logger.debug('CAPTCHA verification bypassed (non-production env)');
      return;
    }

    const body = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });

    if (ip) {
      body.append('remoteip', ip);
    }

    let data: RecaptchaResponse;
    try {
      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body,
      });
      data = (await res.json()) as RecaptchaResponse;
    } catch (error) {
      this.logger.error('reCAPTCHA verification request failed', { error });
      throw new BadRequestException('CAPTCHA verification failed');
    }

    if (!data.success || (data.score !== undefined && data.score < 0.5)) {
      this.logger.warn('reCAPTCHA verification rejected', {
        success: data.success,
        score: data.score,
        errors: data['error-codes'],
      });
      throw new BadRequestException('CAPTCHA verification failed');
    }
  }
}
