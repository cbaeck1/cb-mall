import { Body, Controller, Get, Param, Patch, Post, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { inquiryCreateSchema, inquiryAnswerSchema, productQnaCreateSchema } from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { InquiriesService } from "./inquiries.service";

class InquiryCreateDto extends createZodDto(inquiryCreateSchema) {}
class InquiryAnswerDto extends createZodDto(inquiryAnswerSchema) {}
class ProductQnaCreateDto extends createZodDto(productQnaCreateSchema) {}

@Controller()
export class InquiriesController {
  constructor(private readonly service: InquiriesService) {}

  @Post("inquiries")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: InquiryCreateDto) {
    return this.service.create({ userId: user.id }, dto);
  }

  @Get("mypage/inquiries")
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMine(user.id);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @Get("admin/inquiries")
  adminList() {
    return this.service.listAdmin();
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("inquiry.answer", "Inquiry")
  @Patch("admin/inquiries/:id/answer")
  async answer(@Param("id") id: string, @Body() dto: InquiryAnswerDto) {
    await this.service.answer(id, dto);
    return { ok: true };
  }

  @Post("product-qna")
  createQna(@CurrentUser() user: AuthenticatedUser, @Body() dto: ProductQnaCreateDto) {
    return this.service.createProductQna(user.id, dto);
  }

  @Public()
  @Get("products/:productId/qna")
  listQna(@Param("productId") productId: string) {
    return this.service.listProductQna(productId);
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("product_qna.answer", "ProductQna")
  @Patch("admin/product-qna/:id/answer")
  answerQna(@Param("id") id: string, @Body("answer") answer: string) {
    return this.service.answerProductQna(id, answer);
  }
}
