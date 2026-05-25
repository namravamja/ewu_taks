import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { createWinstonInstance } from './factories/winston.factory';
import type { LoggerModuleConfig } from './interfaces/logger-config.interface';
import { LOGGER_CONFIG, WINSTON_INSTANCE } from './logger.constants';
import { AppLoggerService } from './logger.service';

@Global()
@Module({})
export class LoggerModule {
  static forRoot(config?: LoggerModuleConfig): DynamicModule {
    return {
      module: LoggerModule,
      imports: [ConfigModule],
      providers: [
        { provide: LOGGER_CONFIG, useValue: config ?? {} },
        {
          provide: WINSTON_INSTANCE,
          useFactory: (configService: ConfigService, moduleConfig: LoggerModuleConfig) => {
            const mergedConfig: LoggerModuleConfig = {
              serviceName:
                moduleConfig.serviceName ??
                configService.get<string>('app.appName', 'ewu-media-backend'),
              logLevel: moduleConfig.logLevel ?? configService.get<string>('app.logLevel', 'log'),
              nodeEnv:
                moduleConfig.nodeEnv ?? configService.get<string>('app.nodeEnv', 'development'),
            };
            return createWinstonInstance(mergedConfig);
          },
          inject: [ConfigService, LOGGER_CONFIG],
        },
        AppLoggerService,
      ],
      exports: [AppLoggerService, WINSTON_INSTANCE],
    };
  }
}
