import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { CategoriesController } from "./categories.controller";
import { UploadService } from "./upload.service";

@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, UploadService],
  exports: [UploadService],
})
export class ProductsModule {}
