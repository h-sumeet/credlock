/*
  Warnings:

  - You are about to drop the column `email` on the `email_info` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `phone_info` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email,service_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "email_info" DROP COLUMN "email";

-- AlterTable
ALTER TABLE "phone_info" DROP COLUMN "phone";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_service_id_key" ON "users"("email", "service_id");
