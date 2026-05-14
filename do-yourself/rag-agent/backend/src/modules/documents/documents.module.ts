import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentEntity } from "./entities/document.entity";
import {
  DocumentsRepository,
  IDocumentsRepository,
} from "./repositories/documents.repository";
import {
  DocumentPresenter,
  IDocumentPresenter,
} from "./presenters/document.presenter";
import {
  IngestDocumentsService,
  TIngestDocumentsService,
} from "./services/ingest-documents.service";
import {
  ListSourcesService,
  TListSourcesService,
} from "./services/list-sources.service";
import {
  DeleteSourceService,
  TDeleteSourceService,
} from "./services/delete-source.service";
import { IngestDocumentsController } from "./controllers/ingest-documents.controller";
import { ListSourcesController } from "./controllers/list-sources.controller";
import { DeleteSourceController } from "./controllers/delete-source.controller";
import { OllamaModule } from "@/@shared/providers/ollama/ollama.module";

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity]), OllamaModule],
  controllers: [
    IngestDocumentsController,
    ListSourcesController,
    DeleteSourceController,
  ],
  providers: [
    { provide: IDocumentsRepository, useClass: DocumentsRepository },
    { provide: IDocumentPresenter, useClass: DocumentPresenter },
    { provide: TIngestDocumentsService, useClass: IngestDocumentsService },
    { provide: TListSourcesService, useClass: ListSourcesService },
    { provide: TDeleteSourceService, useClass: DeleteSourceService },
  ],
  exports: [IDocumentsRepository],
})
export class DocumentsModule {}
