import { BadRequestException, createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { POSTGRES_INT4_MAX } from '../pipes/parse-int32-id.pipe';

const POSITIVE_DECIMAL_INTEGER = /^[1-9]\d*$/;

export function parseInt32IdParam(raw: unknown, paramName: string): number {
  const message = `Validation failed (positive int32 numeric string is expected for ${paramName})`;
  if (typeof raw !== 'string' || !POSITIVE_DECIMAL_INTEGER.test(raw)) {
    throw new BadRequestException(message);
  }
  const parsed = Number(raw);
  if (parsed > POSTGRES_INT4_MAX) {
    throw new BadRequestException(message);
  }
  return parsed;
}

export const Int32IdParam = createParamDecorator(
  (paramName: string, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<{ params: Record<string, unknown> }>();
    return parseInt32IdParam(request.params[paramName], paramName); // eslint-disable-line security/detect-object-injection
  },
);
