import { TChatDtoBodySchema } from '../../src/modules/chat/dto/chat.dto';
import { TChatPresenterResponse } from '../../src/modules/chat/presenters/chat.presenter';

export class ChatFactory {
  static createChatDto(overrides: Partial<TChatDtoBodySchema> = {}): TChatDtoBodySchema {
    return {
      question: 'Qual é o conteúdo do documento?',
      ...overrides,
    };
  }

  static createChatResult(overrides: Partial<TChatPresenterResponse> = {}): TChatPresenterResponse {
    return {
      answer: 'O documento contém informações sobre teste.',
      sources: [
        {
          content: 'Conteúdo similar encontrado.',
          source: 'test.pdf',
          similarity: 85,
        },
      ],
      ...overrides,
    };
  }
}
