import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DEFAULT_TWO_FACTOR_TRUSTED_DEVICE_TTL_MS } from '../constants';
import { TokenService } from '../jwt/token.service';
import type { TrustedDeviceInfo } from './trusted-device.repository';
import { TrustedDeviceRepository } from './trusted-device.repository';

@Injectable()
export class TrustedDeviceService {
  constructor(
    private readonly trustedDeviceRepo: TrustedDeviceRepository,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  async createTrustToken(
    userId: number,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = this.tokenService.generateSecureToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const trustedDeviceTtlMs =
      this.config.get<number>('app.twoFactor.trustedDeviceTtlMs') ??
      DEFAULT_TWO_FACTOR_TRUSTED_DEVICE_TTL_MS;
    const expiresAt = new Date(Date.now() + trustedDeviceTtlMs);

    await this.trustedDeviceRepo.create({
      userId,
      tokenHash,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      expiresAt,
    });

    return { rawToken, expiresAt };
  }

  async validateTrustToken(
    rawToken: string,
    userId: number,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<boolean> {
    const tokenHash = this.tokenService.hashToken(rawToken);
    const device = await this.trustedDeviceRepo.findByTokenHash(tokenHash);

    if (!device) return false;
    if (device.userId !== userId) return false;
    if (device.expiresAt < new Date()) return false;
    if (device.ipAddress && device.ipAddress !== meta.ipAddress) return false;
    if (device.userAgent && device.userAgent !== meta.userAgent) return false;

    return true;
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.trustedDeviceRepo.deleteAllByUserId(userId);
  }

  async revokeById(deviceId: number, userId: number): Promise<void> {
    await this.trustedDeviceRepo.deleteById(deviceId, userId);
  }

  async listForUser(userId: number): Promise<TrustedDeviceInfo[]> {
    return this.trustedDeviceRepo.findAllByUserId(userId);
  }

  async cleanupExpired(): Promise<number> {
    return this.trustedDeviceRepo.deleteExpired();
  }
}
