import { Public } from '@mediastar/auth';
import { SkipTransform } from '@mediastar/core';
import { DatabaseService } from '@mediastar/database';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { RedisHealthIndicator } from './redis-health.indicator';

@ApiTags('Health')
@Controller('health')
@Public()
@SkipTransform()
@SkipThrottle()
export class HealthController {
  private readonly heapThreshold: number;
  private readonly rssThreshold: number;
  private readonly diskThresholdPercent: number;
  private readonly dbTimeoutMs: number;

  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly db: DatabaseService,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    configService: ConfigService,
  ) {
    this.heapThreshold = configService.getOrThrow<number>('app.health.heapThresholdBytes');
    this.rssThreshold = configService.getOrThrow<number>('app.health.rssThresholdBytes');
    this.diskThresholdPercent = configService.getOrThrow<number>('app.health.diskThresholdPercent');
    this.dbTimeoutMs = configService.getOrThrow<number>('app.health.dbTimeoutMs');
  }

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Full health check (liveness + readiness)' })
  @ApiResponse({ status: 200, description: 'All checks passed' })
  @ApiResponse({ status: 503, description: 'One or more checks failed' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([...this.livenessIndicators(), ...this.readinessIndicators()]);
  }

  @Get('liveness')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check (memory heap + RSS)' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  @ApiResponse({ status: 503, description: 'Memory threshold exceeded' })
  liveness(): Promise<HealthCheckResult> {
    return this.health.check(this.livenessIndicators());
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check (database, Redis, disk)' })
  @ApiResponse({ status: 200, description: 'All dependencies are ready' })
  @ApiResponse({ status: 503, description: 'One or more dependencies unavailable' })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check(this.readinessIndicators());
  }

  private livenessIndicators(): HealthIndicatorFunction[] {
    return [
      () => this.memory.checkHeap('memory_heap', this.heapThreshold),
      () => this.memory.checkRSS('memory_rss', this.rssThreshold),
    ];
  }

  private readinessIndicators(): HealthIndicatorFunction[] {
    return [
      () => this.prismaHealth.pingCheck('database', this.db, { timeout: this.dbTimeoutMs }),
      () => this.redisHealth.isHealthy('redis'),
      () =>
        this.disk.checkStorage('disk', { path: '/', thresholdPercent: this.diskThresholdPercent }),
    ];
  }
}
