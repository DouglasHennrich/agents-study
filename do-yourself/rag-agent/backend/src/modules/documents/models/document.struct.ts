export interface IDocumentMetadata {
  source: string;
  chunkIndex: number;
  totalChunks: number;
  size?: number;
  mimetype?: string;
}

export interface IDocumentModel {
  id: number;
  content: string;
  metadata: IDocumentMetadata;
  embedding: number[] | null;
  createdAt: Date;
}
