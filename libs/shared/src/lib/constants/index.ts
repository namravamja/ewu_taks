import type { IsStrongPasswordOptions } from 'class-validator';

/** Bcrypt silently truncates passwords beyond 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

/** Minimum password length enforced across the app. */
export const PASSWORD_MIN_LENGTH = 8;

/** Shared strong-password validation options used by all password DTOs. */
export const STRONG_PASSWORD_OPTIONS: IsStrongPasswordOptions = {
  minLength: PASSWORD_MIN_LENGTH,
  minUppercase: 1,
  minLowercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

export { OPERATOR_VALUE_TYPE_MAP } from './operator-value-type.map';
export { POPULATED_USER_SELECT } from './populated-user-select.constant';
