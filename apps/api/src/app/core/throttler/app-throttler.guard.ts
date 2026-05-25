import { IS_PUBLIC_KEY, THROTTLE_TIER_KEY, THROTTLE_TIERS } from '@mediastar/core';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  type ThrottlerGenerateKeyFunction,
  type ThrottlerGetTrackerFunction,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

const THROTTLER_SKIP_KEY = 'THROTTLER:SKIP';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private throttlerMap?: Map<string, ThrottlerOptions>;
  private readonly isDevelopment: boolean;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.isDevelopment = configService.get<string>('app.nodeEnv') === 'development';
  }

  private getThrottlerMap(): Map<string, ThrottlerOptions> {
    if (!this.throttlerMap) {
      this.throttlerMap = new Map(
        this.throttlers.filter((t) => t.name != null).map((t) => [t.name as string, t]),
      );
    }
    return this.throttlerMap;
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isDevelopment) return true;

    const handler = context.getHandler();
    const classRef = context.getClass();

    if (await this.shouldSkip(context)) {
      return true;
    }

    const skipAll = this.reflector.getAllAndOverride<boolean | undefined>(
      `${THROTTLER_SKIP_KEY}default`,
      [handler, classRef],
    );
    if (skipAll) {
      return true;
    }

    const tierName = this.resolveTierName(context);
    const activeThrottler = this.getThrottlerMap().get(tierName);
    if (!activeThrottler) {
      return true;
    }

    const skipNamed = this.reflector.getAllAndOverride<boolean | undefined>(
      `${THROTTLER_SKIP_KEY}${tierName}`,
      [handler, classRef],
    );
    if (skipNamed) {
      return true;
    }

    return this.executeThrottler(context, activeThrottler);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req['user'] as { userId?: number } | undefined;
    return user?.userId ? `user-${user.userId}` : ((req['ip'] as string) ?? 'unknown');
  }

  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    if (name === THROTTLE_TIERS.GLOBAL) {
      const prefix = `${context.getClass().name}-${context.getHandler().name}-${name}`;
      return `throttle:${prefix}:${suffix}`;
    }
    return `throttle:${name}:${suffix}`;
  }

  private resolveTierName(context: ExecutionContext): string {
    const handler = context.getHandler();
    const classRef = context.getClass();

    const explicitTier = this.reflector.getAllAndOverride<string | undefined>(THROTTLE_TIER_KEY, [
      handler,
      classRef,
    ]);
    if (explicitTier) {
      return explicitTier;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      handler,
      classRef,
    ]);
    if (isPublic) {
      return THROTTLE_TIERS.PUBLIC;
    }

    return THROTTLE_TIERS.GLOBAL;
  }

  private async executeThrottler(
    context: ExecutionContext,
    throttler: ThrottlerOptions,
  ): Promise<boolean> {
    const limit = await this.resolveThrottlerValue(context, throttler.limit);
    const ttl = await this.resolveThrottlerValue(context, throttler.ttl);
    const blockDuration = await this.resolveThrottlerValue(context, throttler.blockDuration ?? ttl);
    const getTracker: ThrottlerGetTrackerFunction =
      throttler.getTracker ?? this.commonOptions.getTracker ?? this.getTracker.bind(this);
    const generateKey: ThrottlerGenerateKeyFunction =
      throttler.generateKey ?? this.commonOptions.generateKey ?? this.generateKey.bind(this);

    return this.handleRequest({
      context,
      limit,
      ttl,
      throttler,
      blockDuration,
      getTracker,
      generateKey,
    });
  }

  private async resolveThrottlerValue(
    context: ExecutionContext,
    value: number | ((ctx: ExecutionContext) => number | Promise<number>),
  ): Promise<number> {
    return typeof value === 'function' ? value(context) : value;
  }
}
