import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

// PRD 8.7절: 일반 API는 Authorization: Bearer <AccessToken> 헤더 기반(쿠키 아님) — CSRF와 무관.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("AUTH_REQUIRED");
    }

    try {
      req.user = this.jwt.verify(token);
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException("INVALID_OR_EXPIRED_TOKEN");
    }
  }
}
