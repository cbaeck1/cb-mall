import { Body, Controller, Get, Param, Patch, Query, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { memberSanctionSchema, paginationQuerySchema } from "@cb-mall/shared-types";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { PrismaService } from "../../prisma/prisma.service";

class MemberSanctionDto extends createZodDto(memberSanctionSchema) {}

// FR-7.4: 회원 관리(조회, 등급/제재)
@Roles("ADMIN", "SUPER_ADMIN")
@Controller("admin/members")
export class MembersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const { page, pageSize } = paginationQuerySchema.parse(query);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: "CUSTOMER" },
        select: { id: true, email: true, name: true, isActive: true, pointBalance: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where: { role: "CUSTOMER" } }),
    ]);
    return { items, total, page, pageSize };
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, isActive: true, pointBalance: true, createdAt: true },
    });
  }

  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("member.sanction", "User")
  @Patch(":id/sanction")
  async sanction(@Param("id") id: string, @Body() dto: MemberSanctionDto) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive, deactivatedAt: dto.isActive ? null : new Date() },
    });
    return { ok: true };
  }
}
