import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
// 인증이 필요 없는 엔드포인트에 붙인다 (예: 회원가입, 로그인, 상품 목록)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
