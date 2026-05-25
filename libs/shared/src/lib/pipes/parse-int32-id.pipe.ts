import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

export const POSTGRES_INT4_MAX = 2_147_483_647;

const POSITIVE_DECIMAL_INTEGER = /^[1-9]\d*$/;

@Injectable()
export class ParseInt32IdPipe implements PipeTransform<unknown, number> {
  transform(value: unknown, metadata: ArgumentMetadata): number {
    const name = metadata.data ?? 'value';
    const message = `Validation failed (positive int32 numeric string is expected for ${name})`;

    let parsed: number;
    if (typeof value === 'string') {
      if (!POSITIVE_DECIMAL_INTEGER.test(value)) throw new BadRequestException(message);
      parsed = Number(value);
    } else if (typeof value === 'number') {
      parsed = value;
    } else {
      throw new BadRequestException(message);
    }

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > POSTGRES_INT4_MAX) {
      throw new BadRequestException(message);
    }
    return parsed;
  }
}
