using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MercadoFlow.Desktop.Models;

namespace MercadoFlow.Desktop.Data;

public class MercadoFlowContext : DbContext
{
    private readonly ILogger<MercadoFlowContext>? _logger;

    public MercadoFlowContext(DbContextOptions<MercadoFlowContext> options) : base(options)
    {
    }

    public MercadoFlowContext(
        DbContextOptions<MercadoFlowContext> options,
        ILogger<MercadoFlowContext> logger) : base(options)
    {
        _logger = logger;
    }

    // DbSets principais
    public DbSet<QueueItem> QueueItems { get; set; } = null!;
    public DbSet<InvoiceData> Invoices { get; set; } = null!;
    public DbSet<InvoiceItem> InvoiceItems { get; set; } = null!;
    public DbSet<PaymentInfo> PaymentInfos { get; set; } = null!;
    public DbSet<ProcessedFile> ProcessedFiles { get; set; } = null!;
    public DbSet<ErrorLog> ErrorLogs { get; set; } = null!;
    public DbSet<SystemMetric> SystemMetrics { get; set; } = null!;

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
        {
            optionsBuilder.UseSqlite("Data Source=Data/mercadoflow.db;Cache=Shared");
        }

        // Configurações adicionais
        optionsBuilder.EnableSensitiveDataLogging(false);
        optionsBuilder.EnableDetailedErrors(true);

        if (_logger != null)
        {
            optionsBuilder.LogTo(message => _logger.LogDebug("{DbMessage}", message),
                Microsoft.Extensions.Logging.LogLevel.Information);
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureQueueItem(modelBuilder);
        ConfigureInvoiceData(modelBuilder);
        ConfigureInvoiceItem(modelBuilder);
        ConfigurePaymentInfo(modelBuilder);
        ConfigureProcessedFile(modelBuilder);
        ConfigureErrorLog(modelBuilder);
        ConfigureSystemMetric(modelBuilder);

        // Índices de performance
        CreatePerformanceIndexes(modelBuilder);
    }

    private static void ConfigureQueueItem(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<QueueItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.ChaveNFe)
                .IsRequired()
                .HasMaxLength(44);

            entity.Property(e => e.PayloadJson)
                .IsRequired();

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.DataCriacao)
                .IsRequired()
                .HasDefaultValueSql("datetime('now')");

            entity.Property(e => e.ErroDetalhes)
                .HasMaxLength(4000);

            entity.Property(e => e.ResponseBody)
                .HasMaxLength(4000);

            entity.Property(e => e.ArquivoOrigem)
                .HasMaxLength(500);

            entity.Property(e => e.HashArquivo)
                .HasMaxLength(64);

            entity.Property(e => e.Endpoint)
                .HasMaxLength(200);

            entity.Property(e => e.Tags)
                .HasMaxLength(1000);

            entity.Property(e => e.Metadata)
                .HasMaxLength(4000);

            // Índices
            entity.HasIndex(e => e.ChaveNFe).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.DataCriacao);
            entity.HasIndex(e => e.ProximaTentativa);
            entity.HasIndex(e => new { e.Status, e.Prioridade });
        });
    }

    private static void ConfigureInvoiceData(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InvoiceData>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.ChaveNFe)
                .IsRequired()
                .HasMaxLength(44);

            entity.Property(e => e.CnpjEmitente)
                .IsRequired()
                .HasMaxLength(14);

            entity.Property(e => e.Serie)
                .IsRequired()
                .HasMaxLength(10);

            entity.Property(e => e.Numero)
                .IsRequired()
                .HasMaxLength(20);

            entity.Property(e => e.NomeEmitente)
                .HasMaxLength(200);

            entity.Property(e => e.NomeDestinatario)
                .HasMaxLength(200);

            entity.Property(e => e.CpfCnpjDestinatario)
                .HasMaxLength(14);

            entity.Property(e => e.RawXmlHash)
                .HasMaxLength(64);

            entity.Property(e => e.InformacoesAdicionais)
                .HasMaxLength(4000);

            entity.Property(e => e.TipoOperacao)
                .HasMaxLength(50);

            entity.Property(e => e.NaturezaOperacao)
                .HasMaxLength(200);

            entity.Property(e => e.FormaPagamento)
                .HasMaxLength(100);

            entity.Property(e => e.VersaoXml)
                .HasMaxLength(10);

            entity.Property(e => e.TipoAmbiente)
                .HasMaxLength(20);

            entity.Property(e => e.StatusNfe)
                .HasMaxLength(50);

            entity.Property(e => e.ProtocoloAutorizacao)
                .HasMaxLength(50);

            // Relacionamentos
            entity.HasMany(e => e.Items)
                .WithOne(i => i.Invoice)
                .HasForeignKey(i => i.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Payments)
                .WithOne(p => p.Invoice)
                .HasForeignKey(p => p.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            // Índices
            entity.HasIndex(e => e.ChaveNFe).IsUnique();
            entity.HasIndex(e => e.DataEmissao);
            entity.HasIndex(e => e.CnpjEmitente);
            entity.HasIndex(e => e.ProcessedAt);
            entity.HasIndex(e => new { e.DataEmissao, e.CnpjEmitente });
        });
    }

    private static void ConfigureInvoiceItem(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<InvoiceItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.CodigoEAN)
                .HasMaxLength(14);

            entity.Property(e => e.CodigoInterno)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Descricao)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.Ncm)
                .IsRequired()
                .HasMaxLength(8);

            entity.Property(e => e.Cfop)
                .IsRequired()
                .HasMaxLength(4);

            entity.Property(e => e.UnidadeComercial)
                .IsRequired()
                .HasMaxLength(10);

            entity.Property(e => e.OrigemMercadoria)
                .HasMaxLength(10);

            entity.Property(e => e.CstIcms)
                .HasMaxLength(10);

            entity.Property(e => e.CstIpi)
                .HasMaxLength(10);

            entity.Property(e => e.CstPis)
                .HasMaxLength(10);

            entity.Property(e => e.CstCofins)
                .HasMaxLength(10);

            entity.Property(e => e.InformacoesAdicionais)
                .HasMaxLength(2000);

            entity.Property(e => e.Marca)
                .HasMaxLength(100);

            entity.Property(e => e.Modelo)
                .HasMaxLength(100);

            entity.Property(e => e.Categoria)
                .HasMaxLength(100);

            entity.Property(e => e.Lote)
                .HasMaxLength(50);

            // Índices
            entity.HasIndex(e => e.InvoiceId);
            entity.HasIndex(e => e.CodigoEAN);
            entity.HasIndex(e => e.CodigoInterno);
            entity.HasIndex(e => e.Ncm);
            entity.HasIndex(e => new { e.InvoiceId, e.NumeroItem });
        });
    }

    private static void ConfigurePaymentInfo(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PaymentInfo>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.FormaPagamento)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.MeioPagamento)
                .HasMaxLength(50);

            entity.Property(e => e.TipoIntegracao)
                .HasMaxLength(50);

            entity.Property(e => e.CNPJCredenciadora)
                .HasMaxLength(14);

            entity.Property(e => e.BandeiraCartao)
                .HasMaxLength(50);

            entity.Property(e => e.NumeroAutorizacao)
                .HasMaxLength(100);

            entity.Property(e => e.InformacoesAdicionais)
                .HasMaxLength(1000);

            // Índices
            entity.HasIndex(e => e.InvoiceId);
            entity.HasIndex(e => e.FormaPagamento);
        });
    }

    private static void ConfigureProcessedFile(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProcessedFile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.FileName)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(e => e.FilePath)
                .IsRequired()
                .HasMaxLength(1000);

            entity.Property(e => e.FileHash)
                .IsRequired()
                .HasMaxLength(64);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.ProcessedAt)
                .IsRequired()
                .HasDefaultValueSql("datetime('now')");

            entity.Property(e => e.ErrorMessage)
                .HasMaxLength(2000);

            entity.Property(e => e.ChaveNFe)
                .HasMaxLength(44);

            entity.Property(e => e.Metadata)
                .HasMaxLength(4000);

            // Índices
            entity.HasIndex(e => e.FileHash).IsUnique();
            entity.HasIndex(e => e.ProcessedAt);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.ChaveNFe);
        });
    }

    private static void ConfigureErrorLog(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ErrorLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.Level)
                .IsRequired()
                .HasConversion<int>();

            entity.Property(e => e.Message)
                .IsRequired()
                .HasMaxLength(2000);

            entity.Property(e => e.Exception)
                .HasMaxLength(8000);

            entity.Property(e => e.Source)
                .HasMaxLength(200);

            entity.Property(e => e.Category)
                .HasMaxLength(100);

            entity.Property(e => e.UserId)
                .HasMaxLength(100);

            entity.Property(e => e.MachineName)
                .HasMaxLength(100);

            entity.Property(e => e.FilePath)
                .HasMaxLength(500);

            entity.Property(e => e.AdditionalData)
                .HasMaxLength(4000);

            entity.Property(e => e.Timestamp)
                .IsRequired()
                .HasDefaultValueSql("datetime('now')");

            // Índices
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.Level);
            entity.HasIndex(e => e.Source);
            entity.HasIndex(e => new { e.Level, e.Timestamp });
        });
    }

    private static void ConfigureSystemMetric(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SystemMetric>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.MetricName)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Category)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Unit)
                .HasMaxLength(20);

            entity.Property(e => e.Tags)
                .HasMaxLength(1000);

            entity.Property(e => e.Timestamp)
                .IsRequired()
                .HasDefaultValueSql("datetime('now')");

            // Índices
            entity.HasIndex(e => new { e.MetricName, e.Timestamp });
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.Timestamp);
        });
    }

    private static void CreatePerformanceIndexes(ModelBuilder modelBuilder)
    {
        // Índices compostos para consultas frequentes
        modelBuilder.Entity<QueueItem>()
            .HasIndex(e => new { e.Status, e.DataCriacao, e.Prioridade })
            .HasDatabaseName("IX_QueueItems_Status_DataCriacao_Prioridade");

        modelBuilder.Entity<QueueItem>()
            .HasIndex(e => new { e.ProximaTentativa, e.Status })
            .HasDatabaseName("IX_QueueItems_ProximaTentativa_Status");

        modelBuilder.Entity<InvoiceData>()
            .HasIndex(e => new { e.ProcessedAt, e.MarketId })
            .HasDatabaseName("IX_Invoices_ProcessedAt_MarketId");

        modelBuilder.Entity<InvoiceItem>()
            .HasIndex(e => new { e.CodigoEAN, e.Descricao })
            .HasDatabaseName("IX_InvoiceItems_CodigoEAN_Descricao");

        modelBuilder.Entity<ProcessedFile>()
            .HasIndex(e => new { e.ProcessedAt, e.Status })
            .HasDatabaseName("IX_ProcessedFiles_ProcessedAt_Status");

        modelBuilder.Entity<ErrorLog>()
            .HasIndex(e => new { e.Timestamp, e.Level, e.Source })
            .HasDatabaseName("IX_ErrorLogs_Timestamp_Level_Source");
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is ITimestamped && e.State is EntityState.Added or EntityState.Modified);

        foreach (var entry in entries)
        {
            var entity = (ITimestamped)entry.Entity;

            if (entry.State == EntityState.Added)
            {
                entity.CreatedAt = DateTime.UtcNow;
            }

            entity.UpdatedAt = DateTime.UtcNow;
        }
    }
}

public interface ITimestamped
{
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}

// Models adicionais para o banco de dados
public class ProcessedFile
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileHash { get; set; } = string.Empty;
    public ProcessingStatus Status { get; set; }
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
    public long FileSizeBytes { get; set; }
    public TimeSpan? ProcessingTime { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ChaveNFe { get; set; }
    public int? ItemCount { get; set; }
    public decimal? TotalValue { get; set; }
    public string? Metadata { get; set; }
}

public class ErrorLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public Models.LogLevel Level { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
    public string? Source { get; set; }
    public string? Category { get; set; }
    public string? UserId { get; set; }
    public string? MachineName { get; set; }
    public string? FilePath { get; set; }
    public string? AdditionalData { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class SystemMetric
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string MetricName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public double Value { get; set; }
    public string? Unit { get; set; }
    public string? Tags { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}