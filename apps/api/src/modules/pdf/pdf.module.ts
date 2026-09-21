import { Module } from "@nestjs/common";
import { PdfExtractionService } from "./pdf-extraction.service";
import { PdfExtractionCron } from "./pdf-extraction.cron";

@Module({
  providers: [PdfExtractionService, PdfExtractionCron],
  exports: [PdfExtractionService],
})
export class PdfModule {}
