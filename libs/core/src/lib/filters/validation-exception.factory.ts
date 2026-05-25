import { BadRequestException, HttpException, UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { IFieldError } from '../interfaces/index';

export interface ValidationExceptionPayload {
  statusCode: number;
  message: string;
  validationErrors: IFieldError[];
}

/**
 * Constraint keys treated as business-rule violations → 422 Unprocessable Entity.
 * Everything else (type/format/required) stays 400 Bad Request.
 */
const BUSINESS_RULE_CONSTRAINT_KEYS = new Set<string>(['arrayMaxSize']);

function flattenErrors(errors: ValidationError[], parentPath = ''): IFieldError[] {
  const result: IFieldError[] = [];

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      result.push({
        field,
        message: Object.values(error.constraints).join('; '),
        constraints: error.constraints,
      });
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenErrors(error.children, field));
    }
  }

  return result;
}

function isBusinessRuleOnly(validationErrors: IFieldError[]): boolean {
  if (validationErrors.length === 0) return false;
  return validationErrors.every((e) => {
    const keys = Object.keys(e.constraints ?? {});
    return keys.length > 0 && keys.every((k) => BUSINESS_RULE_CONSTRAINT_KEYS.has(k));
  });
}

export function validationExceptionFactory(errors: ValidationError[]): HttpException {
  const validationErrors = flattenErrors(errors);
  const messages = validationErrors.map((e) => e.message);
  const message = messages.length > 0 ? messages.join('; ') : 'Validation failed';

  const businessRule = isBusinessRuleOnly(validationErrors);
  const statusCode = businessRule ? 422 : 400;

  const payload: ValidationExceptionPayload = {
    statusCode,
    message,
    validationErrors,
  };

  return businessRule
    ? new UnprocessableEntityException(payload)
    : new BadRequestException(payload);
}
