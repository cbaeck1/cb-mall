import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { createZodDto } from "nestjs-zod";
import {
  productCreateSchema,
  productUpdateSchema,
  productStatusUpdateSchema,
  productListQuerySchema,
} from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { ProductsService } from "./products.service";

class ProductCreateDto extends createZodDto(productCreateSchema) {}
class ProductUpdateDto extends createZodDto(productUpdateSchema) {}
class ProductStatusUpdateDto extends createZodDto(productStatusUpdateSchema) {}

interface UploadedFilesShape {
  pdf?: Express.Multer.File[];
  sample?: Express.Multer.File[];
  cover?: Express.Multer.File[];
}

// PRD FR-2.1~2.6: 공개 목록/상세 + 관리자 CRUD. 8.10절: 백엔드 프록시 업로드.
@Controller()
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Public()
  @Get("products")
  list(@Query() query: Record<string, unknown>) {
    return this.service.findPublicList(productListQuerySchema.parse(query));
  }

  @Public()
  @Get("products/:id")
  detail(@Param("id") id: string) {
    return this.service.findPublicDetail(id);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @Get("admin/products/:id")
  adminDetail(@Param("id") id: string) {
    return this.service.findAdminDetail(id);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(
    AuditLogInterceptor,
    FileFieldsInterceptor(
      [
        { name: "pdf", maxCount: 1 },
        { name: "sample", maxCount: 1 },
        { name: "cover", maxCount: 1 },
      ],
      { limits: { fileSize: 100 * 1024 * 1024 } }, // 8.10절: 유형별 상한은 UploadService에서 재확인, 이건 최대 상한 방어선
    ),
  )
  @AuditAction("product.create", "Product")
  @Post("admin/products")
  create(@Body() dto: ProductCreateDto, @UploadedFiles() files: UploadedFilesShape) {
    const pdf = files.pdf?.[0];
    if (!pdf) throw new Error("PDF_FILE_REQUIRED");
    return this.service.createWithPdf(dto, pdf.buffer, files.sample?.[0]?.buffer, files.cover?.[0]?.buffer);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("product.update", "Product")
  @Patch("admin/products/:id")
  update(@Param("id") id: string, @Body() dto: ProductUpdateDto) {
    return this.service.update(id, dto);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("product.status_change", "Product")
  @Patch("admin/products/:id/status")
  updateStatus(@Param("id") id: string, @Body() dto: ProductStatusUpdateDto) {
    return this.service.updateStatus(id, dto.status);
  }

  // FR-2.6: 파일 버전 관리(오탈자 수정본/전면 개정판)
  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor, FileFieldsInterceptor([{ name: "pdf", maxCount: 1 }], { limits: { fileSize: 100 * 1024 * 1024 } }))
  @AuditAction("product.revision", "Product")
  @Post("admin/products/:id/revisions")
  replaceFile(
    @Param("id") id: string,
    @Body("revisionType") revisionType: "ERRATA" | "MAJOR",
    @Body("note") note: string | undefined,
    @UploadedFiles() files: UploadedFilesShape,
  ) {
    const pdf = files.pdf?.[0];
    if (!pdf) throw new Error("PDF_FILE_REQUIRED");
    return this.service.replaceFile(id, revisionType, pdf.buffer, note);
  }
}
