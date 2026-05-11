import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDocumentsTable1700000000000 implements MigrationInterface {
  name = "CreateDocumentsTable1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id"         SERIAL PRIMARY KEY,
        "content"    TEXT NOT NULL,
        "metadata"   JSONB NOT NULL DEFAULT '{}',
        "embedding"  TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "documents_embedding_hnsw_idx"
      ON "documents" USING hnsw (
        (embedding::vector(768)) vector_cosine_ops
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "documents_metadata_source_idx"
      ON "documents" ((metadata->>'source'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
