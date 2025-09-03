-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "password" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" TEXT;
