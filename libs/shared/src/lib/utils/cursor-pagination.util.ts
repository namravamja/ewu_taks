import { CURSOR_PAGINATION_DEFAULTS } from '@mediastar/core';

import type { CursorPaginatedResultVM } from '../dtos/cursor-paginated-result.vm';
import type { CursorPaginationDTO } from '../dtos/cursor-pagination.dto';

export function encodeCursor(value: string | number): string {
  return Buffer.from(String(value)).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

export interface CursorPaginationArgs {
  take: number;
  skip?: number;
  cursor?: Record<string, unknown>;
}

export function buildCursorPaginationArgs(
  query: CursorPaginationDTO,
  cursorField = 'id',
): CursorPaginationArgs {
  const take = Math.min(
    query.limit ?? CURSOR_PAGINATION_DEFAULTS.LIMIT,
    CURSOR_PAGINATION_DEFAULTS.MAX_LIMIT,
  );

  if (!query.cursor) {
    return { take: take + 1 };
  }

  const decodedCursor = decodeCursor(query.cursor);
  return {
    take: take + 1,
    skip: 1,
    cursor: {
      [cursorField]: isNumericString(decodedCursor) ? Number(decodedCursor) : decodedCursor,
    },
  };
}

export function buildCursorPaginatedResult<T extends Record<string, unknown>>(
  data: T[],
  query: CursorPaginationDTO,
  cursorField = 'id',
): CursorPaginatedResultVM<T> {
  const limit = Math.min(
    query.limit ?? CURSOR_PAGINATION_DEFAULTS.LIMIT,
    CURSOR_PAGINATION_DEFAULTS.MAX_LIMIT,
  );

  const hasNextPage = data.length > limit;
  const hasPreviousPage = query.cursor != null;
  const items = hasNextPage ? data.slice(0, limit) : data;

  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  const getCursorValue = (item: T): string | number =>
    Object.getOwnPropertyDescriptor(item, cursorField)?.value as string | number;

  return {
    data: items,
    limit,
    nextCursor: hasNextPage && lastItem ? encodeCursor(getCursorValue(lastItem)) : null,
    previousCursor: hasPreviousPage && firstItem ? encodeCursor(getCursorValue(firstItem)) : null,
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * Builds a directional cursor-paginated result from N+1 fetched data.
 * Handles both forward and backward pagination with direction-encoded cursors.
 *
 * @param data - Raw data including the N+1 overflow row
 * @param query - The cursor pagination query (with optional directional cursor)
 * @param cursorField - The field to extract cursor values from (e.g. 'displayOrder')
 */
export function buildDirectionalCursorPaginatedResult<T extends Record<string, unknown>>(
  data: T[],
  query: CursorPaginationDTO,
  cursorField: string,
): CursorPaginatedResultVM<T> {
  const limit = Math.min(
    query.limit ?? CURSOR_PAGINATION_DEFAULTS.LIMIT,
    CURSOR_PAGINATION_DEFAULTS.MAX_LIMIT,
  );

  const cursor = query.cursor ? decodeDirectionalCursor(query.cursor) : undefined;
  const isBackward = cursor?.direction === 'backward';
  const hasOverflow = data.length > limit;
  const items = hasOverflow ? data.slice(0, limit) : data;

  const hasNextPage = isBackward ? cursor != null : hasOverflow;
  const hasPreviousPage = isBackward ? hasOverflow : cursor != null;

  const firstItem = items[0];
  const lastItem = items[items.length - 1];

  const getCursorValue = (item: T): string | number =>
    Object.getOwnPropertyDescriptor(item, cursorField)?.value as string | number;

  return {
    data: items,
    limit,
    nextCursor:
      hasNextPage && lastItem ? encodeDirectionalCursor(getCursorValue(lastItem), 'forward') : null,
    previousCursor:
      hasPreviousPage && firstItem
        ? encodeDirectionalCursor(getCursorValue(firstItem), 'backward')
        : null,
    hasNextPage,
    hasPreviousPage,
  };
}

export type CursorDirection = 'forward' | 'backward';

export interface DirectionalCursor {
  value: string;
  direction: CursorDirection;
}

export function encodeDirectionalCursor(
  value: string | number,
  direction: CursorDirection,
): string {
  const prefix = direction === 'forward' ? 'f' : 'b';
  return encodeCursor(`${prefix}:${value}`);
}

export function decodeDirectionalCursor(cursor: string): DirectionalCursor {
  const decoded = decodeCursor(cursor);
  if (decoded.length >= 2 && decoded[1] === ':') {
    return {
      value: decoded.substring(2),
      direction: decoded[0] === 'b' ? 'backward' : 'forward',
    };
  }
  return { value: decoded, direction: 'forward' };
}

function isNumericString(value: string): boolean {
  return value !== '' && !isNaN(Number(value));
}
