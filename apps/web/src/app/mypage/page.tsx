import Link from "next/link";

export default function MyPageHome() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">마이페이지</h1>
      <ul className="space-y-2 text-sm">
        <li>
          <Link href="/mypage/downloads" className="text-brand-600 underline">
            구매·다운로드 내역
          </Link>
        </li>
        <li>
          <Link href="/mypage/orders" className="text-brand-600 underline">
            주문 내역
          </Link>
        </li>
        <li>
          <Link href="/mypage/inquiries" className="text-brand-600 underline">
            1:1 문의 내역
          </Link>
        </li>
        <li>
          <Link href="/mypage/mfa" className="text-brand-600 underline">
            2단계 인증 설정
          </Link>
        </li>
      </ul>
    </div>
  );
}
