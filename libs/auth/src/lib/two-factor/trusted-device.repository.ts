import { DatabaseService, PrismaClientKnownRequestError, TxClient } from '@mediastar/database';
import { Injectable } from '@nestjs/common';

export interface TrustedDeviceInfo {
  id: number;
  label: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class TrustedDeviceRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: {
    userId: number;
    tokenHash: string;
    label?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.trustedDevice.create({ data });
  }

  async findByTokenHash(tokenHash: string): Promise<{
    id: number;
    userId: number;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  } | null> {
    return this.db.trustedDevice.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, ipAddress: true, userAgent: true, expiresAt: true },
    });
  }

  async findAllByUserId(userId: number): Promise<TrustedDeviceInfo[]> {
    return this.db.trustedDevice.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        label: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAllByUserId(userId: number, tx?: TxClient): Promise<void> {
    const client = tx ?? this.db;
    await client.trustedDevice.deleteMany({ where: { userId } });
  }

  async deleteById(id: number, userId: number): Promise<void> {
    await this.db.trustedDevice.delete({ where: { id, userId } }).catch((err: unknown) => {
      if (!(err instanceof PrismaClientKnownRequestError && err.code === 'P2025')) {
        throw err;
      }
    });
  }

  async deleteExpired(): Promise<number> {
    const { count } = await this.db.trustedDevice.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
