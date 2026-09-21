import nestjs from "@cb-mall/eslint-config/nestjs";

export default [...nestjs, { ignores: ["prisma/**"] }];
