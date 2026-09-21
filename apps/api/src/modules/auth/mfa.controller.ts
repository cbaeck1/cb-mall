import { Body, Controller, Delete, Post } from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { MfaService } from "./mfa.service";
import { MfaEnableVerifyDto } from "./dto";

// PRD 8.19절: MFA 등록/해제. 관리자는 필수(admin-accounts 모듈에서 강제), 일반 회원은 선택.
@Controller("mfa")
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post("setup")
  setup(@CurrentUser() user: AuthenticatedUser) {
    return this.mfa.beginSetup(user.id, user.email);
  }

  @Post("enable")
  async enable(@CurrentUser() user: AuthenticatedUser, @Body() dto: MfaEnableVerifyDto) {
    const recoveryCodes = await this.mfa.verifyAndEnable(user.id, dto.code);
    return { recoveryCodes };
  }

  @Delete()
  async disable(@CurrentUser() user: AuthenticatedUser) {
    await this.mfa.disable(user.id);
    return { ok: true };
  }
}
