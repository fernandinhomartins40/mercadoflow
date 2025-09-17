using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Models.DTOs;

namespace MercadoFlow.Desktop.Services;

public interface IQueueService
{
    Task<string> EnqueueInvoiceAsync(InvoiceDto invoice, string originalFilePath, int priority = 0);
    Task<QueueItem?> DequeueNextItemAsync(CancellationToken cancellationToken = default);
    Task MarkAsProcessingAsync(string queueItemId);
    Task MarkAsSentAsync(string queueItemId, string? responseBody = null);
    Task MarkAsErrorAsync(string queueItemId, string errorMessage, string? responseBody = null, int? httpStatusCode = null);
    Task MarkAsDeadLetterAsync(string queueItemId, string reason);
    Task RetryFailedItemsAsync(CancellationToken cancellationToken = default);
    Task<QueueStatistics> GetStatisticsAsync();
    Task<List<QueueItem>> GetQueueItemsAsync(QueueStatus? status = null, int skip = 0, int take = 100);
    Task<int> GetQueueSizeAsync(QueueStatus? status = null);
    Task ClearProcessedItemsAsync(TimeSpan olderThan);
    Task ResetStuckItemsAsync(TimeSpan stuckTimeout);
}

public class QueueStatistics
{
    public int TotalItems { get; set; }
    public int PendingItems { get; set; }
    public int ProcessingItems { get; set; }
    public int SentItems { get; set; }
    public int ErrorItems { get; set; }
    public int DeadLetterItems { get; set; }
    public int RetryItems { get; set; }
    public DateTime? OldestPendingItem { get; set; }
    public DateTime? LastProcessedItem { get; set; }
    public TimeSpan? AverageProcessingTime { get; set; }
    public double SuccessRate { get; set; }
    public Dictionary<string, int> ItemsByPriority { get; set; } = new();
    public Dictionary<string, int> ErrorsByType { get; set; } = new();
}