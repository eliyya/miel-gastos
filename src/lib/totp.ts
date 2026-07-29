import "server-only";

import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Martin del Campo Miel";

export function createTotpSecret() {
  return generateSecret();
}

export function createTotpUri(email: string, secret: string) {
  return generateURI({
    issuer: ISSUER,
    label: email,
    secret,
  });
}

export function verifyTotpToken(token: string, secret: string) {
  const result = verifySync({
    token: token.replace(/\s/g, ""),
    secret,
  });

  return result.valid;
}

export async function createTotpQrDataUrl(email: string, secret: string) {
  return QRCode.toDataURL(createTotpUri(email, secret), {
    margin: 1,
    width: 240,
  });
}
