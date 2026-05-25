export interface ISetPassword {
  readonly token: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}
