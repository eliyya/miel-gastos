import { createVendorCache } from "./vendor-cache";

export const customerCache = createVendorCache(
  () => window.localStorage,
  Date.now,
  "miel:sale-customers:v1",
);
