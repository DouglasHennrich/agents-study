import { Controller, Get } from "@nestjs/common";
import { TListSourcesService } from "../services/list-sources.service";

@Controller("documents/sources")
export class ListSourcesController {
  constructor(private readonly listSourcesService: TListSourcesService) {}

  @Get()
  async handle() {
    const result = await this.listSourcesService.execute({});
    if (result.error) throw result.error;
    return { sources: result.getValue() };
  }
}
