import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { CoreService } from './core.service';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { PrismaExceptionFilter } from './filters/prisma-exception.filter';
import { PrismaValidationExceptionFilter } from './filters/prisma-validation-exception.filter';
import { LoggingInterceptor, TimeoutInterceptor, TransformInterceptor } from './interceptors';
import { LoggerModule } from './logger/logger.module';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { ProcessErrorHandlerService } from './process/process-error-handler.service';

@Module({
  imports: [LoggerModule.forRoot()],
  providers: [
    CoreService,
    ProcessErrorHandlerService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaValidationExceptionFilter },
  ],
  exports: [CoreService, ProcessErrorHandlerService],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*path}');
  }
}
