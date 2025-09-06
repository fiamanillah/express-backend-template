/*
  Warnings:

  - The `status` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "status",
ADD COLUMN     "status" "public"."Status" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "public"."courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "short_description" TEXT,
    "thumbnail_url" TEXT,
    "diffuculty_level" TEXT,
    "estimated_duration" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "base_price" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30),
    "discouned_price" DECIMAL(65,30),
    "has_certification" BOOLEAN NOT NULL,
    "pass_percentage" DECIMAL(65,30) DEFAULT 70,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "public"."courses"("slug");
