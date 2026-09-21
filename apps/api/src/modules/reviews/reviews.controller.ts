import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import { reviewCreateSchema } from "@cb-mall/shared-types";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ReviewsService } from "./reviews.service";

class ReviewCreateDto extends createZodDto(reviewCreateSchema) {}

@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Post("reviews")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReviewCreateDto) {
    return this.service.create(user.id, dto);
  }

  @Public()
  @Get("products/:productId/reviews")
  list(@Param("productId") productId: string) {
    return this.service.listByProduct(productId);
  }
}
