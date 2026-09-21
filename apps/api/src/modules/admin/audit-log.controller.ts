import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { paginationQuerySchema } from "@cb-mall/shared-types";

// FR-7.9: 관리자 활동 감사 로그 조회
@Roles("SUPER_ADMIN")
@Controller("admin/audit-logs")
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = paginationQuerySchema.parse(query);
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { email: true, name: true } } },
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
