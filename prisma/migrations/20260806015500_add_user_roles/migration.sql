CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN');

ALTER TABLE "User"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'ADMIN';

UPDATE "User"
SET "role" = 'OWNER'
WHERE "id" = (
  SELECT "id"
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1
);
