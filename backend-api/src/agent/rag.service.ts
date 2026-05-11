import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OpenRouterService } from './open-router.service';

export interface MedicalDocumentChunk {
  id?: string;
  content: string;
  source: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private tableCreated = false;

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureTableExists();
  }

  async ensureTableExists() {
    if (this.tableCreated) return;

    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS medical_knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          content TEXT NOT NULL,
          source VARCHAR(255) NOT NULL,
          embedding vector(1024),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_medical_knowledge_embedding
          ON medical_knowledge USING hnsw (embedding vector_cosine_ops);
      `);

      this.tableCreated = true;
      this.logger.log('medical_knowledge table ensured with vector index');
    } catch (error) {
      this.logger.error(
        `Failed to create medical_knowledge table: ${(error as Error).message}`,
      );
    }
  }

  async embedAndStoreDocuments(
    documents: Array<{
      content: string;
      source: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<number> {
    if (!this.openRouter.isConfigured()) {
      this.logger.warn('OpenRouter not configured, skipping embedding');
      return 0;
    }

    const model = this.openRouter.getModelConfig(
      'EMBEDDING_MODEL',
      'nvidia/llama-nemotron-embed-vl-1b-v2:free',
    );

    let stored = 0;
    const batchSize = 5;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const contents = batch.map((d) => d.content);

      try {
        const embeddingResponse = await this.openRouter.createEmbedding(
          model,
          contents,
        );

        for (let j = 0; j < batch.length; j++) {
          const doc = batch[j];
          const embedding = embeddingResponse.data[j]?.embedding;

          if (embedding) {
            await this.dataSource.query(
              `INSERT INTO medical_knowledge (content, source, embedding, metadata)
               VALUES ($1, $2, $3, $4)`,
              [
                doc.content,
                doc.source,
                `[${embedding.join(',')}]`,
                JSON.stringify(doc.metadata ?? {}),
              ],
            );
            stored++;
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to embed batch ${i / batchSize}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`Stored ${stored}/${documents.length} document chunks`);
    return stored;
  }

  async searchRelevantContext(
    query: string,
    limit = 5,
    threshold = 0.7,
  ): Promise<Array<{ content: string; source: string; similarity: number }>> {
    if (!this.openRouter.isConfigured()) {
      return [];
    }

    try {
      const model = this.openRouter.getModelConfig(
        'EMBEDDING_MODEL',
        'nvidia/llama-nemotron-embed-vl-1b-v2:free',
      );

      const embeddingResponse = await this.openRouter.createEmbedding(
        model,
        query,
      );
      const queryEmbedding = embeddingResponse.data[0]?.embedding;

      if (!queryEmbedding) {
        return [];
      }

      const results = await this.dataSource.query(
        `SELECT content, source, 1 - (embedding <=> $1::vector) AS similarity
         FROM medical_knowledge
         WHERE 1 - (embedding <=> $1::vector) > $2
         ORDER BY similarity DESC
         LIMIT $3`,
        [`[${queryEmbedding.join(',')}]`, threshold, limit],
      );

      return results.map((row: any) => ({
        content: row.content,
        source: row.source,
        similarity: parseFloat(row.similarity),
      }));
    } catch (error) {
      this.logger.error(`RAG search failed: ${(error as Error).message}`);
      return [];
    }
  }

  async getContextForQuery(
    query: string,
    limit = 5,
  ): Promise<{ context: string; sources: string[] }> {
    const results = await this.searchRelevantContext(query, limit);

    if (results.length === 0) {
      return {
        context: 'No relevant medical reference documents found.',
        sources: [],
      };
    }

    const context = results
      .map((r, i) => `[Source ${i + 1}: ${r.source}] ${r.content}`)
      .join('\n\n');

    const sources = results.map((r) => r.source);

    return { context, sources };
  }

  async getDocumentCount(): Promise<number> {
    try {
      const result = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM medical_knowledge',
      );
      return parseInt(result[0].count, 10);
    } catch {
      return 0;
    }
  }

  async clearAllDocuments(): Promise<void> {
    await this.dataSource.query('DELETE FROM medical_knowledge');
    this.logger.log('Cleared all medical knowledge documents');
  }

  async seedDefaultKnowledge(): Promise<void> {
    const existing = await this.getDocumentCount();
    if (existing > 0) {
      this.logger.log(
        `Medical knowledge already has ${existing} documents, skipping seed`,
      );
      return;
    }

    const documents = [
      {
        content:
          'Metformin is a first-line medication for type 2 diabetes. Common side effects include gastrointestinal upset, nausea, and diarrhea. It should be taken with meals. Metformin can cause lactic acidosis in patients with severe kidney impairment. Do not combine with excessive alcohol. Contraindicated in severe renal impairment (eGFR < 30).',
        source: 'WHO Essential Medicines List - Metformin',
        metadata: { drug: 'metformin', category: 'antidiabetic' },
      },
      {
        content:
          'Amlodipine is a calcium channel blocker used for hypertension and angina. Common side effects include peripheral edema, flushing, headache, and dizziness. Can be taken with or without food. Monitor blood pressure regularly. Drug interactions: may increase levels of simvastatin (limit simvastatin to 20mg when used with amlodipine).',
        source: 'WHO Essential Medicines List - Amlodipine',
        metadata: { drug: 'amlodipine', category: 'antihypertensive' },
      },
      {
        content:
          'Aspirin is a nonsteroidal anti-inflammatory drug (NSAID) used for pain, fever, and cardiovascular protection. Low-dose aspirin (75-100mg) is used for secondary prevention of cardiovascular events. Risks include gastrointestinal bleeding and increased bleeding risk. Should not be combined with other anticoagulants without medical supervision. Caution in patients with peptic ulcer disease.',
        source: 'WHO Essential Medicines List - Aspirin',
        metadata: { drug: 'aspirin', category: 'nsaid' },
      },
      {
        content:
          'Drug interaction: Metformin and contrast dye (iodinated) - Metformin should be temporarily discontinued before procedures involving iodinated contrast dye due to risk of lactic acidosis. Restart 48 hours after the procedure if kidney function is normal.',
        source: 'Rwanda National Formulary - Drug Interactions',
        metadata: {
          interaction: 'metformin-contrast-dye',
          severity: 'moderate',
        },
      },
      {
        content:
          'Drug interaction: Aspirin and warfarin - combining aspirin with warfarin significantly increases bleeding risk. This combination should generally be avoided unless specifically indicated and monitored by a physician. If co-administration is necessary, monitor INR closely.',
        source: 'Rwanda National Formulary - Drug Interactions',
        metadata: { interaction: 'aspirin-warfarin', severity: 'high' },
      },
      {
        content:
          'Drug interaction: Amlodipine and simvastatin - amlodipine increases simvastatin levels, increasing risk of myopathy and rhabdomyolysis. Simvastatin dose should not exceed 20mg daily when used with amlodipine.',
        source: 'Rwanda National Formulary - Drug Interactions',
        metadata: {
          interaction: 'amlodipine-simvastatin',
          severity: 'moderate',
        },
      },
      {
        content:
          'Drug interaction: Metformin and alcohol - excessive alcohol intake increases the risk of lactic acidosis in patients taking metformin. Patients should be counseled to limit alcohol consumption.',
        source: 'Rwanda National Formulary - Drug Interactions',
        metadata: { interaction: 'metformin-alcohol', severity: 'moderate' },
      },
      {
        content:
          'Epilepsy management: Missing anticonvulsant doses can trigger seizures. Patients with epilepsy who miss doses should be prioritized for immediate follow-up. If a patient misses 2 or more consecutive doses of anticonvulsant medication, escalate to healthcare provider immediately.',
        source: 'WHO Epilepsy Treatment Guidelines',
        metadata: { condition: 'epilepsy', category: 'adherence' },
      },
      {
        content:
          'Diabetes management: Missing insulin or oral hypoglycemic doses can lead to hyperglycemia. Patients should monitor blood glucose if doses are missed. If blood glucose exceeds 250 mg/dL (13.9 mmol/L) with ketones, seek immediate medical attention.',
        source: 'WHO Diabetes Treatment Guidelines',
        metadata: { condition: 'diabetes', category: 'adherence' },
      },
      {
        content:
          'Hypertension management: Missing antihypertensive doses occasionally is less immediately dangerous than missing epilepsy or diabetes medications. However, consistent non-adherence leads to uncontrolled blood pressure and increased cardiovascular risk. Re-engage patient after 3 consecutive missed doses.',
        source: 'WHO Hypertension Treatment Guidelines',
        metadata: { condition: 'hypertension', category: 'adherence' },
      },
    ];

    await this.embedAndStoreDocuments(documents);
    this.logger.log('Seeded default medical knowledge base');
  }
}
