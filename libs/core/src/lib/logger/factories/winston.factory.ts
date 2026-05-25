import * as winston from 'winston';

import { developmentFormat } from '../formatters/development.formatter';
import { productionFormat } from '../formatters/production.formatter';
import type { LoggerModuleConfig } from '../interfaces/logger-config.interface';

const NEST_TO_WINSTON_LEVEL = new Map<string, string>([
  ['log', 'info'],
  ['error', 'error'],
  ['warn', 'warn'],
  ['debug', 'debug'],
  ['verbose', 'verbose'],
]);

export function createWinstonInstance(config: LoggerModuleConfig): winston.Logger {
  const nodeEnv = config.nodeEnv ?? 'development';
  const isProduction = nodeEnv === 'production' || nodeEnv === 'staging';
  const serviceName = config.serviceName ?? 'ewu-media-backend';

  const rawLevel = config.logLevel ?? (isProduction ? 'info' : 'debug');
  const level = NEST_TO_WINSTON_LEVEL.get(rawLevel) ?? rawLevel;

  const format = isProduction ? productionFormat(serviceName) : developmentFormat();

  return winston.createLogger({
    level,
    defaultMeta: { service: serviceName },
    format,
    transports: [new winston.transports.Console()],
  });
}
