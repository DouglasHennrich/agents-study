import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { OllamaModule } from "../../providers/ollama/ollama.module";
import { ChatController } from "./controllers/chat.controller";
import { ChatPresenter, IChatPresenter } from "./presenters/chat.presenter";
import { ChatService, TChatService } from "./services/chat.service";

@Module({
  imports: [DocumentsModule, OllamaModule],
  controllers: [ChatController],
  providers: [
    { provide: IChatPresenter, useClass: ChatPresenter },
    { provide: TChatService, useClass: ChatService },
  ],
})
export class ChatModule {}
