import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates that a path/query parameter is a 64-character lowercase hex string
 * (SHA-256 digest). Rejects malformed or oversized tokens before any crypto
 * work is performed.
 */
@Injectable()
export class ParseHexTokenPipe implements PipeTransform<string, string> {
  private static readonly HEX_TOKEN_REGEX = /^[0-9a-f]{64}$/;

  transform(value: string): string {
    if (!ParseHexTokenPipe.HEX_TOKEN_REGEX.test(value)) {
      throw new BadRequestException('Invalid token format');
    }
    return value;
  }
}
