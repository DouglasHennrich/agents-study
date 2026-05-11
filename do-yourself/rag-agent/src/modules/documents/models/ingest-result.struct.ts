export interface IIngestResult {
  fileName: string;
  chunks: number;
  status: "success" | "error";
  error?: string;
}
