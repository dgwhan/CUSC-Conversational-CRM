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
      this.deduplicateCustomersAndConversations().catch(() => {});

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
              COALESCE(wc.workspace_name, 'Tổ hợp Công nghệ PolarisX'),
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

    async deduplicateCustomersAndConversations(): Promise<void> {
    try {
      const customers = await this.customer.findMany({
        include: {
          conversations: {
            include: {
              messages: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const groups = new Map<string, typeof customers>();
      for (const cust of customers) {
        const identities = (cust.channelIdentities as any) || {};
        const rawZalo = identities.zalo?.id || (typeof identities.zalo === 'string' ? identities.zalo : null) || identities.zaloId || identities.socialId;
        const rawFb = identities.facebook;
        const realName = cust.fullName && !cust.fullName.startsWith('Khách hàng') && !cust.fullName.startsWith('Lead')
          ? cust.fullName.trim().toLowerCase()
          : null;

        let placeholderKey: string | null = null;
        if (cust.fullName?.startsWith('Khách hàng Zalo #')) {
          placeholderKey = cust.fullName.replace('Khách hàng Zalo #', '').trim();
        }

        const groupKey = rawZalo
          ? `zalo_${rawZalo}`
          : (rawFb
            ? `fb_${rawFb}`
            : (realName
              ? `name_${realName}`
              : (placeholderKey ? `ph_${placeholderKey}` : null)));

        if (!groupKey) continue;
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push(cust);
      }

      for (const [key, duplicates] of groups.entries()) {
        if (duplicates.length <= 1) continue;

        const primary = duplicates.reduce((best, curr) => {
          const score = (c: typeof curr) =>
            (c.fullName.startsWith('Khách hàng') ? 0 : 20) +
            (c.avatarUrl && !c.avatarUrl.includes('ui-avatars.com') ? 10 : 0) +
            (c.phone && c.phone !== 'Chưa có SĐT' ? 5 : 0) +
            c.conversations.reduce((acc, cv) => acc + cv.messages.length, 0);
          return score(curr) > score(best) ? curr : best;
        });

        const others = duplicates.filter((c) => c.id !== primary.id);

        for (const duplicate of others) {
          for (const conv of duplicate.conversations) {
            const existingPrimaryConv = primary.conversations.find((pc) => pc.channelAccountId === conv.channelAccountId);
            if (existingPrimaryConv && existingPrimaryConv.id !== conv.id) {
              await this.message.updateMany({
                where: { conversationId: conv.id },
                data: { conversationId: existingPrimaryConv.id },
              });
              await this.conversation.delete({ where: { id: conv.id } }).catch(() => {});
            } else {
              await this.conversation.update({
                where: { id: conv.id },
                data: { customerId: primary.id },
              }).catch(() => {});
            }
          }

          await this.customer.delete({ where: { id: duplicate.id } }).catch(() => {});
          this.logger.log(`[Deduplicate] Đã gộp customer trùng: "${duplicate.fullName}" (${duplicate.id}) vào "${primary.fullName}" (${primary.id})`);
        }
      }

      await this.customer.deleteMany({
        where: {
          fullName: 'Khách hàng',
          avatarUrl: null,
          conversations: {
            none: {
              messages: { some: {} },
            },
          },
        },
      }).catch(() => {});

      // Xử lý các hội thoại mồ côi (customerId IS NULL) hoặc không có tin nhắn
      const orphanConvs = await this.conversation.findMany({
        where: { customerId: null },
        include: { messages: true },
      }).catch(() => []);

      for (const conv of orphanConvs) {
        if (!conv.messages || conv.messages.length === 0) {
          await this.conversation.delete({ where: { id: conv.id } }).catch(() => {});
          continue;
        }

        // Tìm khách hàng tương ứng từ tin nhắn
        for (const msg of conv.messages) {
          const payload = (msg.rawPayload as any) || {};
          const matchedCustName = payload.customerName;
          const matchedZaloId = payload.idTo || payload.recipient?.id || payload.uidFrom;

          if (matchedCustName || matchedZaloId) {
            const cust = await this.customer.findFirst({
              where: {
                OR: [
                  matchedCustName ? { fullName: matchedCustName } : undefined,
                  matchedZaloId ? { channelIdentities: { path: ['zalo', 'id'], equals: String(matchedZaloId) } } : undefined,
                  matchedZaloId ? { channelIdentities: { path: ['zaloId'], equals: String(matchedZaloId) } } : undefined,
                  matchedZaloId ? { channelIdentities: { path: ['socialId'], equals: String(matchedZaloId) } } : undefined,
                ].filter(Boolean) as any,
              },
              include: { conversations: true },
            });

            if (cust) {
              const primaryConv = cust.conversations[0];
              if (primaryConv && primaryConv.id !== conv.id) {
                await this.message.updateMany({
                  where: { conversationId: conv.id },
                  data: { conversationId: primaryConv.id },
                });
                await this.conversation.delete({ where: { id: conv.id } }).catch(() => {});
              } else {
                await this.conversation.update({
                  where: { id: conv.id },
                  data: { customerId: cust.id },
                }).catch(() => {});
              }
              break;
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Deduplicate routine notice: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Disconnected from PostgreSQL database');
  }
}
