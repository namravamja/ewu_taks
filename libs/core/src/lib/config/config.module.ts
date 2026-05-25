import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { configuration } from './configuration';
import { validate, validateApi } from './validation';

@Module({})
export class AppConfigModule {
  static forRoot(options?: { schema?: 'api' }): DynamicModule {
    return {
      module: AppConfigModule,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validate: options?.schema === 'api' ? validateApi : validate,
          envFilePath: process.env['ENV_FILE'] ?? '.env',
        }),
      ],
      exports: [NestConfigModule],
    };
  }
}
