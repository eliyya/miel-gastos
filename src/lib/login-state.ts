export type LoginState = {
  error?: string;
  fields?: Partial<Record<"email" | "password" | "totpCode", string>>;
};
