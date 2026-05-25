import { TWO_FACTOR_TOKEN_HEADER } from '@mediastar/auth';
import {
  AppLoggerService,
  CORRELATION_HEADER,
  isValidHttpsUrl,
  ProcessErrorHandlerService,
  TypedInputPipe,
  validationExceptionFactory,
} from '@mediastar/core';
import { ErrorResponseVM } from '@mediastar/shared';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import basicAuth from 'express-basic-auth';
import helmet from 'helmet';

import { AppModule } from './app/app.module';
import { stripPublicSecurity, swaggerResponseInterceptor } from './swagger.utils';

const NODE_ENV_KEY = 'app.nodeEnv';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = await app.resolve(AppLoggerService);
  app.useLogger(logger);
  app.get(ProcessErrorHandlerService).bindApp(app);
  const configService = app.get(ConfigService);

  logger.setContext('Bootstrap');
  logger.info('Module initialization complete — configuring middleware');

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new TypedInputPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  const corsOrigin = configService.getOrThrow<string>('app.corsOrigin');
  const nodeEnv = configService.get<string>(NODE_ENV_KEY);
  if (nodeEnv === 'production' && !isValidHttpsUrl(corsOrigin)) {
    throw new Error(`CORS_ORIGIN must use HTTPS in production, got: ${corsOrigin}`);
  }
  const allowedFrontendUrls = configService.get<string[]>('app.allowedFrontendUrls') ?? [];
  const corsOrigins = [...new Set([corsOrigin, ...allowedFrontendUrls].filter(Boolean))];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Last-Event-ID',
      TWO_FACTOR_TOKEN_HEADER,
      CORRELATION_HEADER,
      'Idempotency-Key',
    ],
  });
  app.enableShutdownHooks();
  logger.info('Middleware configured — setting up Swagger and listener');

  if (configService.get<string>(NODE_ENV_KEY) !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EWU Media API')
      .setDescription('EWU Media Backend REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addSecurityRequirements('access-token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      extraModels: [ErrorResponseVM],
    });

    stripPublicSecurity(app, document, 'api');

    if (configService.get<string>(NODE_ENV_KEY) !== 'development') {
      const swaggerUser = configService.getOrThrow<string>('app.swagger.user');
      const swaggerPassword = configService.getOrThrow<string>('app.swagger.password');

      app.use(
        ['/docs', '/docs-json', '/docs-yaml'],
        basicAuth({
          users: { [swaggerUser]: swaggerPassword },
          challenge: true,
        }),
      );
    }

    SwaggerModule.setup('/docs', app, document, {
      customSiteTitle: 'EWU Media API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        withCredentials: true,
        responseInterceptor: swaggerResponseInterceptor,
      },
    });

    logger.setContext('Swagger');
    logger.info('Swagger UI available at /docs');
  }

  const port = configService.get<number>('app.port') ?? 3000;
  logger.info(`Calling app.listen(${port}) on 0.0.0.0`);
  await app.listen(port, '0.0.0.0');
  logger.setContext('API');
  logger.info(`API server running on http://0.0.0.0:${port}/api`);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- logger may not be initialized if bootstrap fails
  console.error(err);
  new Logger('API').error('Failed to start API', err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});
