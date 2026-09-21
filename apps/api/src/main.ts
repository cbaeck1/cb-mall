import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { patchNestJsSwagger } from "nestjs-zod";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

// PRD 8.7/8.22절: 브라우저가 api. 도메인을 직접 호출(BFF 경유 없음, 8.66절 O-1) — 여기서 CORS를 직접 다룬다.
async function bootstrap() {
  patchNestJsSwagger(); // nestjs-zod DTO를 Swagger 스키마로 변환

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = config.get<string>("CORS_ALLOWED_ORIGINS")!.split(",").map((s) => s.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // Refresh 쿠키(httpOnly) 전송을 위해 필요
  });

  // 8.41절: API 문서는 운영에서 비활성화(스테이징까지만 노출)
  if (config.get<string>("NODE_ENV") !== "production") {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("cb몰 API").setVersion("0.1.0").addBearerAuth().build(),
    );
    SwaggerModule.setup("docs", app, document);
  }

  const port = config.get<number>("PORT")!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`cb몰 API listening on :${port}`);
}

bootstrap();
