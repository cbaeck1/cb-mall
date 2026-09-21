// PRD 8.20절: 관리자 계정은 초대 기반 생성만 허용하므로, 최초 1명은 배포 시 시드 스크립트로 만든다.
// 실행: pnpm --filter @cb-mall/api run db:seed (SEED_SUPER_ADMIN_EMAIL/PASSWORD 환경변수 필요)
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("SEED_SUPER_ADMIN_EMAIL/PASSWORD가 설정되지 않아 관리자 시드를 건너뜁니다.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`이미 존재하는 계정입니다: ${email}`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "최초 관리자",
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`SUPER_ADMIN 계정 생성 완료: ${email}`);
  console.log("⚠ 로그인 후 즉시 MFA를 설정하세요(8.19절: 관리자는 MFA 필수).");

  // 개발 편의를 위한 기본 카테고리(운영에서는 관리자 화면에서 생성)
  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    await prisma.category.createMany({
      data: [{ name: "자기계발" }, { name: "경제/경영" }, { name: "IT/프로그래밍" }, { name: "소설" }],
    });
    console.log("기본 카테고리 생성 완료");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
