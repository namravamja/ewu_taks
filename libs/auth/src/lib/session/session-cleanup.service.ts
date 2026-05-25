import { AppLoggerService } from '@mediastar/core';
import { Injectable } from '@nestjs/common';

import { TrustedDeviceRepository } from '../two-factor/trusted-device.repository';
import { SessionRepository } from './session.repository';

@Injectable()
export class SessionCleanupService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(SessionCleanupService.name);
  }

  async handleSessionCleanup(): Promise<void> {
    const sessionCount = await this.sessionRepository.deleteExpired();
    const deviceCount = await this.trustedDeviceRepository.deleteExpired();
    this.logger.info(
      `Cleaned up ${sessionCount} expired session(s) and ${deviceCount} expired trusted device(s)`,
    );
  }
}
