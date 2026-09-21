import { Body, Controller, Get, Param, Patch, Post, UseInterceptors } from "@nestjs/common";
import { inviteAdminSchema, acceptAdminInvitationSchema } from "@cb-mall/shared-types";
import { createZodDto } from "nestjs-zod";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { AdminAccountsService } from "./admin-accounts.service";

class InviteAdminDto extends createZodDto(inviteAdminSchema) {}
class AcceptAdminInvitationDto extends createZodDto(acceptAdminInvitationSchema) {}

// PRD FR-7.8: 관리자 계정 관리(SUPER_ADMIN 전용)
@UseInterceptors(AuditLogInterceptor)
@Controller("admin/accounts")
export class AdminAccountsController {
  constructor(private readonly service: AdminAccountsService) {}

  @Roles("SUPER_ADMIN")
  @Get()
  list() {
    return this.service.list();
  }

  @Roles("SUPER_ADMIN")
  @Get("invitations")
  listInvitations() {
    return this.service.listInvitations();
  }

  @Roles("SUPER_ADMIN")
  @Post("invitations")
  @AuditAction("admin.invite", "AdminInvitation")
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteAdminDto) {
    return this.service.invite(user.id, dto);
  }

  @Public()
  @Post("invitations/accept")
  accept(@Body() dto: AcceptAdminInvitationDto) {
    return this.service.accept(dto);
  }

  @Roles("SUPER_ADMIN")
  @Patch(":id/deactivate")
  @AuditAction("admin.deactivate", "User")
  async deactivate(@Param("id") id: string) {
    await this.service.deactivate(id);
    return { ok: true };
  }

  @Roles("SUPER_ADMIN")
  @Patch(":id/role")
  @AuditAction("admin.role_change", "User")
  async changeRole(@Param("id") id: string, @Body("role") role: "ADMIN" | "SUPER_ADMIN") {
    await this.service.changeRole(id, role);
    return { ok: true };
  }
}
