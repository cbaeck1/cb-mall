import { Body, Controller, Delete, Get, Param, Post, UseInterceptors } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { categoryCreateSchema } from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuditAction, AuditLogInterceptor } from "../../common/interceptors/audit-log.interceptor";
import { PrismaService } from "../../prisma/prisma.service";

class CategoryCreateDto extends createZodDto(categoryCreateSchema) {}

@Controller("categories")
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.category.findMany({ orderBy: { name: "asc" } });
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("category.create", "Category")
  @Post()
  create(@Body() dto: CategoryCreateDto) {
    return this.prisma.category.create({ data: dto });
  }

  @Roles("ADMIN", "SUPER_ADMIN")
  @UseInterceptors(AuditLogInterceptor)
  @AuditAction("category.delete", "Category")
  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
