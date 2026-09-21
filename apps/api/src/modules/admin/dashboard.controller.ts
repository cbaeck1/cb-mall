import { Controller, Get } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { DashboardService } from "./dashboard.service";

@Roles("ADMIN", "SUPER_ADMIN")
@Controller("admin/dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  summary() {
    return this.service.summary();
  }
}
