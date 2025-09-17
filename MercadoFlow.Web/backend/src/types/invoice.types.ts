// Document and XML version types (converted from Prisma enums to string literals)
export type DocumentType = 'NFE' | 'NFCE';
export type XmlVersion = 'VERSION_310' | 'VERSION_400' | 'UNKNOWN';

// Invoice ingestion from desktop app
export interface InvoiceIngestionRequest {
  chaveNFe: string;
  marketId: string;
  agentVersion: string;
  rawXmlHash: string;
  invoice: InvoiceData;
}

export interface InvoiceData {
  chaveNFe: string;
  serie: string;
  numero: string;
  dataEmissao: string;
  documentType: DocumentType;
  xmlVersion: XmlVersion;

  // Emitente
  cnpjEmitente: string;
  nomeEmitente: string;
  enderecoEmitente?: EmitterAddress;

  // Destinatário
  cpfCnpjDestinatario?: string;
  nomeDestinatario?: string;
  enderecoDestinatario?: RecipientAddress;

  // Totais
  valorTotal: number;
  valorTotalItens: number;
  valorTotalTributos?: number;

  // Itens
  itens: InvoiceItemData[];

  // Pagamentos
  pagamentos?: PaymentData[];

  // Informações adicionais
  observacoes?: string;
  informacoesAdicionais?: string;
}

export interface InvoiceItemData {
  numeroItem: number;
  codigoEAN: string;
  codigoInterno: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidadeComercial: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;

  // Tributos
  tributos?: {
    icms?: TributeTax;
    pis?: TributeTax;
    cofins?: TributeTax;
    ipi?: TributeTax;
  };

  // Informações do produto
  categoria?: string;
  marca?: string;
  origem?: string;
}

export interface TributeTax {
  situacaoTributaria: string;
  baseCalculo?: number;
  aliquota?: number;
  valor?: number;
}

export interface PaymentData {
  formaPagamento: string;
  valor: number;
  descricao?: string;
}

export interface EmitterAddress {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  nomeMunicipio: string;
  uf: string;
  cep: string;
  telefone?: string;
}

export interface RecipientAddress {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  codigoMunicipio?: string;
  nomeMunicipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
}

// Response types for invoice queries
export interface InvoiceListResponse {
  invoices: InvoiceSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoiceSummary {
  id: string;
  chaveNFe: string;
  serie: string;
  numero: string;
  dataEmissao: Date;
  cnpjEmitente: string;
  nomeEmitente: string;
  valorTotal: number;
  documentType: DocumentType;
  itemCount: number;
  processedAt: Date;
}

export interface InvoiceDetails extends InvoiceSummary {
  cpfCnpjDestinatario?: string;
  nomeDestinatario?: string;
  xmlVersion: XmlVersion;
  rawXmlHash: string;
  items: InvoiceItemSummary[];
  market: {
    id: string;
    name: string;
    city: string;
    state: string;
  };
  pdv?: {
    id: string;
    name: string;
    identifier: string;
  };
}

export interface InvoiceItemSummary {
  id: string;
  numeroItem: number;
  codigoEAN: string;
  codigoInterno: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  product?: {
    id: string;
    name: string;
    category: string;
    brand?: string;
  };
}

// Batch processing types
export interface BatchInvoiceRequest {
  invoices: InvoiceIngestionRequest[];
  processOptions?: {
    skipDuplicates?: boolean;
    validateSchema?: boolean;
    updateIfExists?: boolean;
  };
}

export interface BatchInvoiceResponse {
  processed: number;
  skipped: number;
  errors: number;
  results: Array<{
    chaveNFe: string;
    status: 'success' | 'error' | 'skipped';
    message?: string;
    invoiceId?: string;
  }>;
}

// Invoice validation types
export interface InvoiceValidationResult {
  isValid: boolean;
  errors: InvoiceValidationError[];
  warnings: InvoiceValidationWarning[];
}

export interface InvoiceValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface InvoiceValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}