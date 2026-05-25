import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { CORRELATION_HEADER } from '../constants/index';
import { requestContextStorage } from '../context/correlation-id';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.get(CORRELATION_HEADER);
    const correlationId = header && UUID_V4_REGEX.test(header) ? header : randomUUID();

    res.setHeader(CORRELATION_HEADER, correlationId);

    requestContextStorage.run({ correlationId }, () => {
      next();
    });
  }
}
