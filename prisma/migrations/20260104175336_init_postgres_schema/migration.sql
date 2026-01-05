-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "fullname" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "profile_image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_info" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_expires" TIMESTAMP(3),
    "pending_email" TEXT,
    "provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_info" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_otp" TEXT,
    "otp_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_info" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hash" TEXT,
    "reset_token" TEXT,
    "reset_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lockout_info" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_until" TIMESTAMP(3),
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lockout_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_info_user_id_key" ON "email_info"("user_id");

-- CreateIndex
CREATE INDEX "email_info_verification_token_idx" ON "email_info"("verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "phone_info_user_id_key" ON "phone_info"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_info_user_id_key" ON "password_info"("user_id");

-- CreateIndex
CREATE INDEX "password_info_reset_token_idx" ON "password_info"("reset_token");

-- CreateIndex
CREATE UNIQUE INDEX "lockout_info_user_id_key" ON "lockout_info"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "email_info" ADD CONSTRAINT "email_info_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_info" ADD CONSTRAINT "phone_info_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_info" ADD CONSTRAINT "password_info_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lockout_info" ADD CONSTRAINT "lockout_info_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
