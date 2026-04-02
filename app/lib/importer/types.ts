export type ImportSourceId =
  | 'json_ld'
  | 'open_graph'
  | 'selectors'
  | 'playwright_render'
  | 'retailer_strategy'
  | 'llm_enrichment';

export interface ProductPrice {
  amount?: number;
  currency?: string;
  text?: string;
}

export interface PartialProductFields {
  title?: string;
  brand?: string;
  type?: string;
  color?: string;
  size?: string;
  material?: string;
  description?: string;
  tags?: string[];
  price?: ProductPrice;
  images?: string[];
  sku?: string;
}

export interface ParserResult {
  sourceId: ImportSourceId;
  fields: PartialProductFields;
  raw?: Record<string, unknown>;
  note?: string;
}

export interface ProductImportDraft extends PartialProductFields {
  url: string;
  images: string[];
  price?: ProductPrice;
  sourceTrail: ImportSourceTrace[];
  warnings: string[];
  rawSections: Record<string, unknown>;
  scrapedAt: string;
}

export interface ImportSourceTrace {
  id: ImportSourceId;
  usedFields: (keyof PartialProductFields)[];
  wasFallback: boolean;
  note?: string;
}

export interface ImportProductOptions {
  preferPlaywright?: boolean;
  playwrightTimeoutMs?: number;
}
