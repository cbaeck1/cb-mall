-- PRD.md 8.20절: 관리자별 개별 계정, 초대 기반 생성, SUPER_ADMIN/ADMIN 권한, 감사 로그

-- role enum에 SUPER_ADMIN 추가
ALTER TYPE "role" ADD VALUE 'SUPER_ADMIN';

-- users: 관리자 퇴사 등에 대비한 비활성화(soft-disable) 컬럼
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMP(3);

CREATE TYPE "admin_invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- admin_invitations: 관리자 계정은 초대로만 생성
CREATE TABLE "admin_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "role" "role" NOT NULL DEFAULT 'ADMIN',
    "token_hash" TEXT NOT NULL,
    "invited_by_id" UUID NOT NULL,
    "status" "admin_invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_invitations_token_hash_key" ON "admin_invitations"("token_hash");
CREATE INDEX "admin_invitations_invited_by_id_idx" ON "admin_invitations"("invited_by_id");
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- admin_audit_logs: 관리자 주요 행위 감사 로그
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "summary" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_logs_actor_id_idx" ON "admin_audit_logs"("actor_id");
CREATE INDEX "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8.6절 정책에 따라 RLS 방어적 이중화 적용
ALTER TABLE "admin_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_audit_logs" ENABLE ROW LEVEL SECURITY;
