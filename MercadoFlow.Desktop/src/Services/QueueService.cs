using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Data;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Models.DTOs;

namespace MercadoFlow.Desktop.Services;

public class QueueService : IQueueService
{
    private readonly MercadoFlowContext _context;
    private readonly ILogger<QueueService> _logger;
    private readonly PerformanceSettings _performanceSettings;
    private readonly ApiSettings _apiSettings;
    private readonly object _lockObject = new();

    public QueueService(
        MercadoFlowContext context,
        ILogger<QueueService> logger,
        IOptions<PerformanceSettings> performanceSettings,
        IOptions<ApiSettings> apiSettings)
    {
        _context = context;
        _logger = logger;
        _performanceSettings = performanceSettings.Value;
        _apiSettings = apiSettings.Value;
    }

    public async Task<string> EnqueueInvoiceAsync(InvoiceDto invoice, string originalFilePath, int priority = 0)
    {
        if (invoice == null)
            throw new ArgumentNullException(nameof(invoice));

        if (string.IsNullOrWhiteSpace(invoice.ChaveNFe))
            throw new ArgumentException("Chave NFe é obrigatória", nameof(invoice));

        try
        {
            // Verificar se já existe na fila
            var existingItem = await _context.QueueItems
                .FirstOrDefaultAsync(q => q.ChaveNFe == invoice.ChaveNFe);

            if (existingItem != null)
            {
                _logger.LogWarning("Item já existe na fila: {ChaveNFe}", invoice.ChaveNFe);
                return existingItem.Id;
            }

            // Serializar payload
            var payloadJson = JsonSerializer.Serialize(invoice, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            });

            // Criar item da fila
            var queueItem = new QueueItem
            {
                ChaveNFe = invoice.ChaveNFe,
                PayloadJson = payloadJson,
                Status = QueueStatus.Pending,
                ArquivoOrigem = originalFilePath,
                TamanhoArquivo = payloadJson.Length,
                Endpoint = _apiSettings.IngestEndpoint,
                Prioridade = priority,
                DataCriacao = DateTime.UtcNow,
                Metadata = JsonSerializer.Serialize(new
                {
                    ItemCount = invoice.Items?.Count ?? 0,
                    ValorTotal = invoice.ValorTotal,
                    CnpjEmitente = invoice.CnpjEmitente,
                    DataEmissao = invoice.DataEmissao
                })
            };

            _context.QueueItems.Add(queueItem);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Item adicionado à fila: {ChaveNFe} (ID: {QueueItemId})",
                invoice.ChaveNFe, queueItem.Id);

            return queueItem.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao adicionar item à fila: {ChaveNFe}", invoice.ChaveNFe);
            throw;
        }
    }

    public async Task<QueueItem?> DequeueNextItemAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            lock (_lockObject)
            {
                var currentTime = DateTime.UtcNow;

                // Buscar próximo item para processar (ordenado por prioridade e data)
                var nextItem = _context.QueueItems
                    .Where(q => q.Status == QueueStatus.Pending ||
                               (q.Status == QueueStatus.Retry && q.ProximaTentativa <= currentTime))
                    .Where(q => q.Tentativas < _apiSettings.RetryAttempts)
                    .OrderByDescending(q => q.Prioridade)
                    .ThenBy(q => q.DataCriacao)
                    .FirstOrDefault();

                if (nextItem == null)
                    return null;

                // Marcar como processando para evitar processamento duplo
                nextItem.Status = QueueStatus.Processing;
                nextItem.DataProcessamento = currentTime;
                nextItem.Tentativas++;

                _context.SaveChanges();

                _logger.LogDebug("Item retirado da fila: {ChaveNFe} (Tentativa {Tentativas})",
                    nextItem.ChaveNFe, nextItem.Tentativas);

                return nextItem;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao retirar item da fila");
            return null;
        }
    }

    public async Task MarkAsProcessingAsync(string queueItemId)
    {
        try
        {
            var item = await _context.QueueItems.FindAsync(queueItemId);
            if (item == null)
            {
                _logger.LogWarning("Item não encontrado para marcar como processando: {QueueItemId}", queueItemId);
                return;
            }

            item.Status = QueueStatus.Processing;
            item.DataProcessamento = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogDebug("Item marcado como processando: {ChaveNFe}", item.ChaveNFe);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao marcar item como processando: {QueueItemId}", queueItemId);
        }
    }

    public async Task MarkAsSentAsync(string queueItemId, string? responseBody = null)
    {
        try
        {
            var item = await _context.QueueItems.FindAsync(queueItemId);
            if (item == null)
            {
                _logger.LogWarning("Item não encontrado para marcar como enviado: {QueueItemId}", queueItemId);
                return;
            }

            var processingTime = item.DataProcessamento.HasValue
                ? DateTime.UtcNow - item.DataProcessamento.Value
                : TimeSpan.Zero;

            item.Status = QueueStatus.Sent;
            item.DataEnvio = DateTime.UtcNow;
            item.ResponseBody = responseBody?.Length > 4000 ? responseBody[..4000] : responseBody;
            item.TempoProcessamento = processingTime;
            item.ErroDetalhes = null; // Limpar erros anteriores

            await _context.SaveChangesAsync();

            _logger.LogInformation("Item marcado como enviado: {ChaveNFe} (Tempo: {ProcessingTime}ms)",
                item.ChaveNFe, processingTime.TotalMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao marcar item como enviado: {QueueItemId}", queueItemId);
        }
    }

    public async Task MarkAsErrorAsync(string queueItemId, string errorMessage, string? responseBody = null, int? httpStatusCode = null)
    {
        try
        {
            var item = await _context.QueueItems.FindAsync(queueItemId);
            if (item == null)
            {
                _logger.LogWarning("Item não encontrado para marcar como erro: {QueueItemId}", queueItemId);
                return;
            }

            var processingTime = item.DataProcessamento.HasValue
                ? DateTime.UtcNow - item.DataProcessamento.Value
                : TimeSpan.Zero;

            item.Status = item.Tentativas >= _apiSettings.RetryAttempts ? QueueStatus.DeadLetter : QueueStatus.Error;
            item.ErroDetalhes = errorMessage.Length > 4000 ? errorMessage[..4000] : errorMessage;
            item.ResponseBody = responseBody?.Length > 4000 ? responseBody[..4000] : responseBody;
            item.HttpStatusCode = httpStatusCode;
            item.TempoProcessamento = processingTime;

            // Calcular próxima tentativa se ainda não excedeu o limite
            if (item.Tentativas < _apiSettings.RetryAttempts)
            {
                var retryDelay = GetRetryDelay(item.Tentativas);
                item.ProximaTentativa = DateTime.UtcNow.Add(retryDelay);
                item.Status = QueueStatus.Retry;

                _logger.LogWarning("Item marcado para retry: {ChaveNFe} (Tentativa {Tentativas}/{MaxAttempts}, Próxima em {RetryDelay})",
                    item.ChaveNFe, item.Tentativas, _apiSettings.RetryAttempts, retryDelay);
            }
            else
            {
                _logger.LogError("Item movido para dead letter: {ChaveNFe} (Tentativas esgotadas)",
                    item.ChaveNFe);
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao marcar item como erro: {QueueItemId}", queueItemId);
        }
    }

    public async Task MarkAsDeadLetterAsync(string queueItemId, string reason)
    {
        try
        {
            var item = await _context.QueueItems.FindAsync(queueItemId);
            if (item == null)
            {
                _logger.LogWarning("Item não encontrado para marcar como dead letter: {QueueItemId}", queueItemId);
                return;
            }

            item.Status = QueueStatus.DeadLetter;
            item.ErroDetalhes = $"Dead Letter: {reason}";

            await _context.SaveChangesAsync();

            _logger.LogError("Item movido para dead letter: {ChaveNFe} - {Reason}",
                item.ChaveNFe, reason);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao marcar item como dead letter: {QueueItemId}", queueItemId);
        }
    }

    public async Task RetryFailedItemsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var currentTime = DateTime.UtcNow;

            var itemsToRetry = await _context.QueueItems
                .Where(q => q.Status == QueueStatus.Error && q.Tentativas < _apiSettings.RetryAttempts)
                .ToListAsync(cancellationToken);

            foreach (var item in itemsToRetry)
            {
                var retryDelay = GetRetryDelay(item.Tentativas);
                item.Status = QueueStatus.Retry;
                item.ProximaTentativa = currentTime.Add(retryDelay);
            }

            if (itemsToRetry.Any())
            {
                await _context.SaveChangesAsync(cancellationToken);
                _logger.LogInformation("Marcados {Count} itens para retry", itemsToRetry.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao marcar itens para retry");
        }
    }

    public async Task<QueueStatistics> GetStatisticsAsync()
    {
        try
        {
            var stats = new QueueStatistics();

            var allItems = await _context.QueueItems.ToListAsync();

            stats.TotalItems = allItems.Count;
            stats.PendingItems = allItems.Count(q => q.Status == QueueStatus.Pending);
            stats.ProcessingItems = allItems.Count(q => q.Status == QueueStatus.Processing);
            stats.SentItems = allItems.Count(q => q.Status == QueueStatus.Sent);
            stats.ErrorItems = allItems.Count(q => q.Status == QueueStatus.Error);
            stats.DeadLetterItems = allItems.Count(q => q.Status == QueueStatus.DeadLetter);
            stats.RetryItems = allItems.Count(q => q.Status == QueueStatus.Retry);

            stats.OldestPendingItem = allItems
                .Where(q => q.Status == QueueStatus.Pending)
                .OrderBy(q => q.DataCriacao)
                .FirstOrDefault()?.DataCriacao;

            stats.LastProcessedItem = allItems
                .Where(q => q.DataEnvio.HasValue)
                .OrderByDescending(q => q.DataEnvio)
                .FirstOrDefault()?.DataEnvio;

            var completedItems = allItems.Where(q => q.TempoProcessamento.HasValue).ToList();
            if (completedItems.Any())
            {
                stats.AverageProcessingTime = TimeSpan.FromMilliseconds(
                    completedItems.Average(q => q.TempoProcessamento!.Value.TotalMilliseconds));
            }

            var totalProcessed = stats.SentItems + stats.ErrorItems + stats.DeadLetterItems;
            stats.SuccessRate = totalProcessed > 0 ? (double)stats.SentItems / totalProcessed * 100 : 0;

            stats.ItemsByPriority = allItems
                .GroupBy(q => $"Prioridade {q.Prioridade}")
                .ToDictionary(g => g.Key, g => g.Count());

            stats.ErrorsByType = allItems
                .Where(q => !string.IsNullOrEmpty(q.ErroDetalhes))
                .GroupBy(q => GetErrorType(q.ErroDetalhes!))
                .ToDictionary(g => g.Key, g => g.Count());

            return stats;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter estatísticas da fila");
            return new QueueStatistics();
        }
    }

    public async Task<List<QueueItem>> GetQueueItemsAsync(QueueStatus? status = null, int skip = 0, int take = 100)
    {
        try
        {
            var query = _context.QueueItems.AsQueryable();

            if (status.HasValue)
            {
                query = query.Where(q => q.Status == status.Value);
            }

            return await query
                .OrderByDescending(q => q.Prioridade)
                .ThenBy(q => q.DataCriacao)
                .Skip(skip)
                .Take(take)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter itens da fila");
            return new List<QueueItem>();
        }
    }

    public async Task<int> GetQueueSizeAsync(QueueStatus? status = null)
    {
        try
        {
            var query = _context.QueueItems.AsQueryable();

            if (status.HasValue)
            {
                query = query.Where(q => q.Status == status.Value);
            }

            return await query.CountAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter tamanho da fila");
            return 0;
        }
    }

    public async Task ClearProcessedItemsAsync(TimeSpan olderThan)
    {
        try
        {
            var cutoffDate = DateTime.UtcNow - olderThan;

            var itemsToDelete = await _context.QueueItems
                .Where(q => q.Status == QueueStatus.Sent && q.DataEnvio < cutoffDate)
                .ToListAsync();

            if (itemsToDelete.Any())
            {
                _context.QueueItems.RemoveRange(itemsToDelete);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Removidos {Count} itens processados antigos da fila", itemsToDelete.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao limpar itens processados da fila");
        }
    }

    public async Task ResetStuckItemsAsync(TimeSpan stuckTimeout)
    {
        try
        {
            var cutoffTime = DateTime.UtcNow - stuckTimeout;

            var stuckItems = await _context.QueueItems
                .Where(q => q.Status == QueueStatus.Processing && q.DataProcessamento < cutoffTime)
                .ToListAsync();

            foreach (var item in stuckItems)
            {
                item.Status = QueueStatus.Pending;
                item.DataProcessamento = null;

                _logger.LogWarning("Item travado foi resetado: {ChaveNFe}", item.ChaveNFe);
            }

            if (stuckItems.Any())
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Resetados {Count} itens travados", stuckItems.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao resetar itens travados");
        }
    }

    private TimeSpan GetRetryDelay(int attemptNumber)
    {
        if (attemptNumber <= 0 || attemptNumber > _apiSettings.RetryDelays.Count)
        {
            return TimeSpan.FromSeconds(Math.Pow(2, Math.Min(attemptNumber, 8))); // Exponential backoff máximo de 256s
        }

        return _apiSettings.RetryDelays[attemptNumber - 1];
    }

    private static string GetErrorType(string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(errorMessage))
            return "Desconhecido";

        var lower = errorMessage.ToLowerInvariant();

        if (lower.Contains("timeout") || lower.Contains("timed out"))
            return "Timeout";
        if (lower.Contains("connection") || lower.Contains("network"))
            return "Conectividade";
        if (lower.Contains("401") || lower.Contains("unauthorized"))
            return "Autenticação";
        if (lower.Contains("403") || lower.Contains("forbidden"))
            return "Autorização";
        if (lower.Contains("404") || lower.Contains("not found"))
            return "Não Encontrado";
        if (lower.Contains("500") || lower.Contains("internal server"))
            return "Erro do Servidor";
        if (lower.Contains("validation") || lower.Contains("invalid"))
            return "Validação";

        return "Outros";
    }
}