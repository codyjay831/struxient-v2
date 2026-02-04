-- CreateEnum
CREATE TYPE "NodeKind" AS ENUM ('MAINLINE', 'DETOUR');

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "nodeKind" "NodeKind" NOT NULL DEFAULT 'MAINLINE';
