export interface IResetPassword {
  readonly token: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}
