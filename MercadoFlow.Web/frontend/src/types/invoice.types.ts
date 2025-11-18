export interface Invoice {
  id: string;
  chaveAcesso: string;
  numeroNota: string;
  serieNota: string;
  dataEmissao: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  valorTotal: number;
  marketId: string;
  processedAt?: string;
  createdAt: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId?: string;
  codigoEAN?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  categoria?: string;
  marca?: string;
  unidadeComercial?: string;
}

export interface InvoiceStatistics {
  totalInvoices: number;
  totalValue: number;
  averageValue: number;
  totalItems: number;
  uniqueSuppliers: number;
  period: {
    start: string;
    end: string;
  };
}

export interface InvoiceUploadResult {
  success: boolean;
  invoiceId?: string;
  errors?: string[];
  warnings?: string[];
}
