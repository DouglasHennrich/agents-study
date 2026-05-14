import { Injectable } from "@nestjs/common";
import { AbstractPresenter } from "../../../@shared/classes/presenter";
import { IIngestResult } from "../models/ingest-result.struct";

export type TIngestResultPresenterResponse = {
  fileName: string;
  chunks: number;
  status: "success" | "error";
  error?: string;
};

export abstract class IDocumentPresenter extends AbstractPresenter<
  IIngestResult,
  TIngestResultPresenterResponse
> {}

@Injectable()
export class DocumentPresenter extends IDocumentPresenter {
  present(result: IIngestResult): TIngestResultPresenterResponse {
    return {
      fileName: result.fileName,
      chunks: result.chunks,
      status: result.status,
      ...(result.error ? { error: result.error } : {}),
    };
  }
}
