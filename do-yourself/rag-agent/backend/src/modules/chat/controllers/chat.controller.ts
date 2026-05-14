import { Body, Controller, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../../../@shared/pipes/zod-validation.pipe";
import { chatDtoBodySchema, TChatDtoBodySchema } from "../dto/chat.dto";
import { TChatService } from "../services/chat.service";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: TChatService) {}

  @Post()
  async handle(
    @Body(new ZodValidationPipe(chatDtoBodySchema)) dto: TChatDtoBodySchema,
  ) {
    const result = await this.chatService.execute(dto);
    if (result.error) throw result.error;
    return result.getValue();
  }
}
