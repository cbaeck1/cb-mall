import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

// PRD 8.15절: 런타임은 cbmall_app 최소권한 롤 + Supavisor 트랜잭션 모드 풀러로 접속한다.
// 접속 계정 자체는 인프라(roles.sql, DATABASE_URL)에서 결정되며 여기서는 다루지 않는다.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
