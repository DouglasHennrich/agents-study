import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { TIngestDocumentsService } from "../services/ingest-documents.service";

@Controller("documents/ingest")
export class IngestDocumentsController {
  constructor(
    private readonly ingestDocumentsService: TIngestDocumentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      limits: { fileSize: 60 * 1024 * 1024 },
    }),
  )
  async handle(@UploadedFiles() files: Express.Multer.File[]) {
    const result = await this.ingestDocumentsService.execute(
      (files ?? []).map((f) => ({
        originalname: f.originalname,
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
    );
    if (result.error) throw result.error;
    return { results: result.getValue() };
  }
}
