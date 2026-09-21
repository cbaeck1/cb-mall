import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthController } from "./auth.controller";
import { MfaController } from "./mfa.controller";
import { AuthService } from "./auth.service";
import { TokensService } from "./tokens.service";
import { MfaService } from "./mfa.service";

// JwtModule은 app.module.ts에서 전역(global: true)으로 한 번만 등록한다 — AuthModule이 다시
// 등록하면 서로 다른 JwtService 인스턴스가 생겨 서명/검증 설정이 어긋날 수 있다.
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController, MfaController],
  providers: [AuthService, TokensService, MfaService],
  exports: [TokensService],
})
export class AuthModule {}
