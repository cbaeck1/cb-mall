import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { JwtModule } from "@nestjs/jwt";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { RateLimitModule } from "./common/rate-limit/rate-limit.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";

import { AuthModule } from "./modules/auth/auth.module";
import { ProductsModule } from "./modules/products/products.module";
import { PdfModule } from "./modules/pdf/pdf.module";
import { SearchModule } from "./modules/search/search.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { PointsModule } from "./modules/points/points.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { InquiriesModule } from "./modules/inquiries/inquiries.module";
import { AdminModule } from "./modules/admin/admin.module";
import { MembersModule } from "./modules/members/members.module";
import { PushModule } from "./modules/push/push.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 8.24절: 구조화 JSON 로그(nestjs-pino) + 민감정보 자동 마스킹(redact)
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.newPassword",
            "req.body.code",
            "req.body.tokenRaw",
            "*.passwordHash",
            "*.mfaSecretEnc",
            "*.tossSecretKey",
          ],
          censor: "[REDACTED]",
        },
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    RateLimitModule,
    // 8.7절: 전역 등록 — AuthModule의 서명과 JwtAuthGuard의 검증이 반드시 같은 설정(비밀키·TTL)을 공유해야 한다.
    // 각자 따로 등록하면 서로 다른 JwtService 인스턴스가 생겨 "발급한 토큰을 검증 못 하는" 사고가 난다.
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_ACCESS_TTL") },
      }),
    }),

    HealthModule,
    AuthModule,
    ProductsModule,
    PdfModule,
    SearchModule,
    OrdersModule,
    PaymentsModule,
    EntitlementsModule,
    NotificationsModule,
    CouponsModule,
    PointsModule,
    ReviewsModule,
    InquiriesModule,
    AdminModule,
    MembersModule,
    PushModule,
  ],
  providers: [
    Reflector,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1) 인증 — req.user 채움
    { provide: APP_GUARD, useClass: RolesGuard }, // 2) 인가 — @Roles() 검사
  ],
})
export class AppModule {}
