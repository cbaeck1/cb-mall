import { Body, Controller, Get, Param, Post, Req, UseInterceptors } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { grantDownloadLimitSchema } from "@cb-mall/shared-types";
import { createZodDto } from "nestjs-zod";
import { EntitlementsService } from "./entitlements.service";

class GrantDownloadLimitDto extends createZodDto(grantDownloadLimitSchema) {}

// PRD FR-4.1~4.5, FR-7.10
@Controller()
export class EntitlementsController {
  constructor(private readonly service: EntitlementsService) {}

  @Get("mypage/downloads")
  myDownloads(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listForUser(user.id);
  }

  @Post("entitlements/:id/download")
  download(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.service.download(id, { userId: user.id }, req.ip, req.headers["user-agent"] as string);
  }

  // FR-4.3: 비회원 — 이메일 일회성 링크(capability 토큰)
  @Public()
  @Post("guest-download/:accessToken")
  guestDownload(@Param("accessToken") accessToken: string, @Req() req: Request) {
    return this.service.guestDownload(accessToken, req.ip, req.headers["user-agent"] as string);
  }

  // FR-7.10
  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("entitlement.grant_download_limit", "Entitlement")
  @Post("admin/entitlements/grant-limit")
  async grant(@Body() dto: GrantDownloadLimitDto) {
    await this.service.grantAdditional(dto.entitlementId, dto.additionalDownloads);
    return { ok: true };
  }
}
