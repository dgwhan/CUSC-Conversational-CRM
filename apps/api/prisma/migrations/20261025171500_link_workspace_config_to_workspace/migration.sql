-- 1. Deduplicate workspace_configurations keeping latest per owner
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
