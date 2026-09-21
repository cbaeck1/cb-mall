import cbMallNext from "@cb-mall/eslint-config/next";

// PRD 8.48/8.66절: react/no-danger을 error로 강제(8.61절 J-5 XSS 방지의 코드 레벨 안전장치)
export default [...cbMallNext, { ignores: [".next/**", "public/**", "next-env.d.ts", "scripts/**"] }];
