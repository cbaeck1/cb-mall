import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";

export const AUDIT_ACTION_KEY = "auditAction";
interface AuditMeta {
  action: string;
  targetType: string;
}

// FR-7.9: 관리자 활동 감사 로그. @AuditAction("order.cancel", "Order") 형태로 컨트롤러 핸들러에 붙여 사용.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const meta: AuditMeta | undefined = Reflect.getMetadata(AUDIT_ACTION_KEY, handler);

    return next.handle().pipe(
      tap((result) => {
        if (!meta || !req.user) return;
        const targetId = req.params?.id ?? (result as { id?: string })?.id ?? "N/A";
        this.prisma.adminAuditLog
          .create({
            data: {
              actorId: req.user.id,
              action: meta.action,
              targetType: meta.targetType,
              targetId: String(targetId),
              summary: { body: req.body, params: req.params, query: req.query },
              ipAddress: req.ip,
            },
          })
          .catch(() => {
            // 감사 로그 실패로 본 요청을 실패시키지 않는다. 실패 자체는 pino 로그로 남는다.
          });
      }),
    );
  }
}

export const AuditAction = (action: string, targetType: string) =>
  Reflect.metadata(AUDIT_ACTION_KEY, { action, targetType });
