CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "role" TEXT,
  "banned" INTEGER,
  "banReason" TEXT,
  "banExpires" DATE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "impersonatedBy" TEXT
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

INSERT INTO "user" (
  "id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "banned"
)
SELECT
  lower(hex(randomblob(16))),
  legacy.name,
  lower(legacy.email),
  1,
  NULL,
  legacy.created_at,
  legacy.updated_at,
  'user',
  0
FROM users legacy
WHERE NOT EXISTS (
  SELECT 1 FROM "user" current WHERE current.email = lower(legacy.email)
);

INSERT INTO "account" (
  "id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))),
  current.id,
  'credential',
  current.id,
  legacy.password_hash,
  legacy.created_at,
  legacy.updated_at
FROM users legacy
JOIN "user" current ON current.email = lower(legacy.email)
WHERE NOT EXISTS (
  SELECT 1 FROM "account" existing
  WHERE existing.userId = current.id AND existing.providerId = 'credential'
);

DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
