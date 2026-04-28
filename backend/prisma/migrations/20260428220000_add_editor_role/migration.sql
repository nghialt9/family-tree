-- AlterEnum: add 'editor' value between 'viewer' and 'admin'
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'editor';
