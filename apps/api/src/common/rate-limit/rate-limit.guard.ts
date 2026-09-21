import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PostgresRateLimitService } from "./postgres-rate-limit.service";
import { RATE_LIMIT_KEY, type RateLimitOptions } from "./rate-limit.decorator";

@Injectable()
export class PostgresRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: PostgresRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) return true;

    const req = context.switchToHttp().getRequest();
    const routeKey = `${context.getClass().name}.${context.getHandler().name}`;
    const identity = options.keyBy === "email" ? req.body?.email ?? req.ip : req.ip;
    const key = `${routeKey}:${options.keyBy}:${identity}`;

    const allowed = await this.rateLimit.consume(key, options.limit, options.windowSeconds);
    if (!allowed) {
      throw new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: "RATE_LIMITED" }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
