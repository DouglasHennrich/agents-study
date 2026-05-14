import { Injectable } from "@nestjs/common";
import { AbstractPresenter } from "../../../@shared/classes/presenter";
import { ISimilarDocument } from "../../documents/repositories/documents.repository";

export type TChatPresenterResponse = {
  answer: string;
  sources: Array<{
    content: string;
    source: string;
    similarity: number;
  }>;
};

export interface IChatResult {
  answer: string;
  similarDocuments: ISimilarDocument[];
}

export abstract class IChatPresenter extends AbstractPresenter<
  IChatResult,
  TChatPresenterResponse
> {}

@Injectable()
export class ChatPresenter extends IChatPresenter {
  present(result: IChatResult): TChatPresenterResponse {
    return {
      answer: result.answer,
      sources: result.similarDocuments.map((doc) => ({
        content:
          doc.content.length > 200
            ? doc.content.substring(0, 200) + "..."
            : doc.content,
        source: doc.metadata.source,
        similarity: Math.round(doc.similarity * 10000) / 100,
      })),
    };
  }
}
