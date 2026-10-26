import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: pg.Pool;

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL database successfully via Prisma');

      // Tự động đảm bảo các cột và bảng cấu hình workspace & ràng buộc staff-owner tồn tại
      try {
        await this.$executeRawUnsafe(`
          ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
          CREATE INDEX IF NOT EXISTS "staff_owner_id_idx" ON "staff"("owner_id");

          CREATE TABLE IF NOT EXISTS "workspace_configurations" (
              "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              "workspace_id" UUID UNIQUE,
              "owner_id" UUID NOT NULL,
              "domain" VARCHAR(50) NOT NULL DEFAULT 'EDUCATION',
              "workspace_name" VARCHAR(255),
              "terminology" JSONB NOT NULL DEFAULT '{}',
              "pipeline_stages" JSONB NOT NULL DEFAULT '[]',
              "product_catalog" JSONB NOT NULL DEFAULT '[]',
              "criteria" JSONB NOT NULL DEFAULT '[]',
              "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS "workspace_configurations_owner_id_idx" ON "workspace_configurations"("owner_id");

          -- Đảm bảo foreign key từ workspace_configurations đến workspaces
          DO $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = 'workspace_configurations_workspace_id_fkey'
              ) THEN
                  ALTER TABLE "workspace_configurations" 
                  ADD CONSTRAINT "workspace_configurations_workspace_id_fkey" 
                  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
              END IF;
          END $$;

          -- 1. Deduplicate: Nếu một owner có nhiều cấu hình, giữ lại bản ghi mới nhất
          DELETE FROM "workspace_configurations"
          WHERE id NOT IN (
              SELECT DISTINCT ON (owner_id) id
              FROM "workspace_configurations"
              ORDER BY owner_id, updated_at DESC, created_at DESC
          );

          -- 2. Tự động tạo workspace cho các owner chưa có workspace trong bảng workspaces
          INSERT INTO "workspaces" ("id", "name", "slug", "owner_id", "is_active", "created_at", "updated_at")
          SELECT 
              gen_random_uuid(),
              COALESCE(wc.workspace_name, 'Trung tâm Công nghệ Phần mềm CUSC'),
              CONCAT('ws-', SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)),
              wc.owner_id,
              true,
              NOW(),
              NOW()
          FROM "workspace_configurations" wc
          WHERE NOT EXISTS (
              SELECT 1 FROM "workspaces" w WHERE w.owner_id = wc.owner_id
          )
          ON CONFLICT DO NOTHING;

          -- 3. Cập nhật và kết nối workspace_id của workspace_configurations với id của workspaces
          UPDATE "workspace_configurations" wc
          SET "workspace_id" = w.id
          FROM (
              SELECT DISTINCT ON (owner_id) id, owner_id
              FROM "workspaces"
              ORDER BY owner_id, created_at ASC
          ) w
          WHERE wc.owner_id = w.owner_id
            AND (wc.workspace_id IS NULL OR wc.workspace_id != w.id);
        `);
        this.logger.log('Auto-repaired workspace_configurations: linked workspace_id to workspaces.id');
      } catch (ddlError) {
        this.logger.warn(`DDL auto-sync note: ${(ddlError as Error).message}`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Disconnected from PostgreSQL database');
  }
}
