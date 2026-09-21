import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PointsService } from "./points.service";

@Controller("points")
export class PointsController {
  constructor(private readonly service: PointsService) {}

  @Get("me")
  myHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.service.history(user.id);
  }
}
