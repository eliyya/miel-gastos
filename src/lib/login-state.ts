export type LoginState = {
  step?: "totp";
  error?: string;
  fields?: Partial<Record<"email" | "password" | "totpCode", string>>;
};
