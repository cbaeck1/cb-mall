import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp
      ? exception.getResponse()
      : { statusCode: status, message: "INTERNAL_SERVER_ERROR" };

    if (!isHttp) {
      // 8.24절: 민감정보(비밀번호 등)는 nestjs-pino의 redact 설정에서 처리됨
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    res.status(status).json(typeof body === "string" ? { statusCode: status, message: body } : body);
  }
}
