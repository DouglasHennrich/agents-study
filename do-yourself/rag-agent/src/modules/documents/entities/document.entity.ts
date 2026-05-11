import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { vectorTransformer } from "../../../@database/vector.transformer";
import { IDocumentModel } from "../models/document.struct";
import { IDocumentMetadata } from "../models/document.struct";

@Entity("documents")
export class DocumentEntity implements IDocumentModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  content: string;

  @Column("jsonb", { default: {} })
  metadata: IDocumentMetadata;

  @Column({ type: "text", nullable: true, transformer: vectorTransformer })
  embedding: number[] | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
