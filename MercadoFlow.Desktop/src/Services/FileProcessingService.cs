using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Data;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Parsers;

namespace MercadoFlow.Desktop.Services;

public class FileProcessingService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<FileProcessingService> _logger;
    private readonly PerformanceSettings _performanceSettings;
    private readonly MonitoringSettings _monitoringSettings;

    private IFileMonitoringService? _fileMonitoringService;
    private IXmlParserService? _xmlParserService;
    private IZipFileProcessor? _zipFileProcessor;
    private IQueueService? _queueService;
    private IApiService? _apiService;

    private readonly SemaphoreSlim _processingSemaphore;
    private readonly Timer _queueProcessorTimer;
    private bool _isProcessingQueue;

    public FileProcessingService(
        IServiceProvider serviceProvider,
        ILogger<FileProcessingService> logger,
        IOptions<PerformanceSettings> performanceSettings,
        IOptions<MonitoringSettings> monitoringSettings)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _performanceSettings = performanceSettings.Value;
        _monitoringSettings = monitoringSettings.Value;

        _processingSemaphore = new SemaphoreSlim(_performanceSettings.MaxConcurrentProcessing, _performanceSettings.MaxConcurrentProcessing);
        _queueProcessorTimer = new Timer(ProcessQueueItems, null, Timeout.Infinite, Timeout.Infinite);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Serviço de processamento de arquivos iniciando...");

        try
        {
            // Obter serviços
            await InitializeServicesAsync();

            // Configurar eventos do monitoramento de arquivos
            _fileMonitoringService!.FileDetected += OnFileDetected;
            _fileMonitoringService.FileProcessingUpdate += OnFileProcessingUpdate;
            _fileMonitoringService.StatusChanged += OnMonitoringStatusChanged;

            // Iniciar monitoramento de arquivos
            await _fileMonitoringService.StartMonitoringAsync(stoppingToken);

            // Iniciar processamento da fila
            _queueProcessorTimer.Change(TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(10));

            _logger.LogInformation("Serviço de processamento de arquivos iniciado com sucesso");

            // Aguardar cancelamento
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Serviço de processamento de arquivos foi cancelado");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro crítico no serviço de processamento de arquivos");
            throw;
        }
        finally
        {
            await CleanupAsync();
        }
    }

    private async Task InitializeServicesAsync()
    {
        using var scope = _serviceProvider.CreateScope();

        _fileMonitoringService = scope.ServiceProvider.GetRequiredService<IFileMonitoringService>();
        _xmlParserService = scope.ServiceProvider.GetRequiredService<IXmlParserService>();
        _zipFileProcessor = scope.ServiceProvider.GetRequiredService<IZipFileProcessor>();
        _queueService = scope.ServiceProvider.GetRequiredService<IQueueService>();
        _apiService = scope.ServiceProvider.GetRequiredService<IApiService>();

        _logger.LogDebug("Serviços inicializados com sucesso");
    }

    private async void OnFileDetected(object? sender, FileDetectedEventArgs e)
    {
        try
        {
            _logger.LogInformation("Arquivo detectado: {FileName} ({FileSize} bytes)",
                e.FileName, e.FileSizeBytes);

            // Aguardar semáforo para controlar concorrência
            await _processingSemaphore.WaitAsync();

            _ = Task.Run(async () =>
            {
                try
                {
                    await ProcessFileAsync(e);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erro ao processar arquivo: {FilePath}", e.FilePath);
                    await LogProcessingError(e.FilePath, ex);
                }
                finally
                {
                    _processingSemaphore.Release();
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao iniciar processamento do arquivo: {FilePath}", e.FilePath);
        }
    }

    private async Task ProcessFileAsync(FileDetectedEventArgs fileInfo)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MercadoFlowContext>();

        var processedFile = new ProcessedFile
        {
            FileName = fileInfo.FileName,
            FilePath = fileInfo.FilePath,
            FileHash = fileInfo.FileHash ?? string.Empty,
            FileSizeBytes = fileInfo.FileSizeBytes,
            Status = ProcessingStatus.Processing
        };

        try
        {
            context.ProcessedFiles.Add(processedFile);
            await context.SaveChangesAsync();

            if (fileInfo.IsZipFile)
            {
                await ProcessZipFileAsync(fileInfo, processedFile, context);
            }
            else
            {
                await ProcessXmlFileAsync(fileInfo.FilePath, processedFile, context);
            }

            // Mover arquivo para pasta processados se configurado
            if (_monitoringSettings.MoveToProcessedFolder && !string.IsNullOrWhiteSpace(_monitoringSettings.ProcessedFolderPath))
            {
                await MoveToProcessedFolderAsync(fileInfo.FilePath);
            }

            // Deletar arquivo original se configurado
            if (_monitoringSettings.DeleteAfterProcessing)
            {
                await DeleteFileAsync(fileInfo.FilePath);
            }

            processedFile.Status = ProcessingStatus.Completed;
            await context.SaveChangesAsync();

            _logger.LogInformation("Arquivo processado com sucesso: {FileName}", fileInfo.FileName);
        }
        catch (Exception ex)
        {
            processedFile.Status = ProcessingStatus.Error;
            processedFile.ErrorMessage = ex.Message;
            await context.SaveChangesAsync();

            _logger.LogError(ex, "Erro ao processar arquivo: {FileName}", fileInfo.FileName);
            throw;
        }
    }

    private async Task ProcessZipFileAsync(FileDetectedEventArgs fileInfo, ProcessedFile processedFile, MercadoFlowContext context)
    {
        _logger.LogDebug("Processando arquivo ZIP: {FileName}", fileInfo.FileName);

        var extractResults = await _zipFileProcessor!.ExtractXmlFilesAsync(fileInfo.FilePath);

        if (!extractResults.Any())
        {
            throw new InvalidOperationException("Nenhum arquivo XML encontrado no ZIP");
        }

        var successCount = 0;
        var errorCount = 0;

        foreach (var extractResult in extractResults)
        {
            if (!extractResult.Success)
            {
                _logger.LogWarning("Falha ao extrair {FileName} do ZIP: {Error}",
                    extractResult.FileName, extractResult.ErrorMessage);
                errorCount++;
                continue;
            }

            try
            {
                var parseResult = await _xmlParserService!.ParseXmlAsync(extractResult.XmlContent, extractResult.FileName);

                if (parseResult.Success && parseResult.InvoiceData != null)
                {
                    await _queueService!.EnqueueInvoiceAsync(parseResult.InvoiceData, $"{fileInfo.FilePath}:{extractResult.FileName}");
                    successCount++;

                    // Salvar dados da invoice localmente
                    var invoiceData = MapToInvoiceData(parseResult.InvoiceData, parseResult.RawXmlHash);
                    context.Invoices.Add(invoiceData);
                }
                else
                {
                    _logger.LogWarning("Falha ao fazer parse do XML {FileName}: {Error}",
                        extractResult.FileName, parseResult.ErrorMessage);
                    errorCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar XML {FileName} do ZIP", extractResult.FileName);
                errorCount++;
            }
        }

        processedFile.ItemCount = successCount;
        processedFile.ErrorMessage = errorCount > 0 ? $"{errorCount} itens falharam no processamento" : null;

        await context.SaveChangesAsync();

        _logger.LogInformation("ZIP processado: {FileName} - {SuccessCount} sucessos, {ErrorCount} erros",
            fileInfo.FileName, successCount, errorCount);
    }

    private async Task ProcessXmlFileAsync(string filePath, ProcessedFile processedFile, MercadoFlowContext context)
    {
        _logger.LogDebug("Processando arquivo XML: {FilePath}", filePath);

        var parseResult = await _xmlParserService!.ParseXmlFileAsync(filePath);

        if (!parseResult.Success || parseResult.InvoiceData == null)
        {
            throw new InvalidOperationException($"Falha ao fazer parse do XML: {parseResult.ErrorMessage}");
        }

        // Adicionar à fila de envio
        await _queueService!.EnqueueInvoiceAsync(parseResult.InvoiceData, filePath);

        // Salvar dados da invoice localmente
        var invoiceData = MapToInvoiceData(parseResult.InvoiceData, parseResult.RawXmlHash);
        context.Invoices.Add(invoiceData);

        processedFile.ChaveNFe = parseResult.InvoiceData.ChaveNFe;
        processedFile.ItemCount = parseResult.InvoiceData.Items?.Count ?? 0;
        processedFile.TotalValue = parseResult.InvoiceData.ValorTotal;
        processedFile.ProcessingTime = parseResult.ProcessingTime;

        await context.SaveChangesAsync();

        _logger.LogInformation("XML processado: {FileName} - Chave: {ChaveNFe}",
            Path.GetFileName(filePath), parseResult.InvoiceData.ChaveNFe);
    }

    private async Task MoveToProcessedFolderAsync(string filePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_monitoringSettings.ProcessedFolderPath))
                return;

            Directory.CreateDirectory(_monitoringSettings.ProcessedFolderPath);

            var fileName = Path.GetFileName(filePath);
            var destinationPath = Path.Combine(_monitoringSettings.ProcessedFolderPath, fileName);

            // Se arquivo já existe, adicionar timestamp
            if (File.Exists(destinationPath))
            {
                var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                var extension = Path.GetExtension(fileName);
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                fileName = $"{nameWithoutExt}_{timestamp}{extension}";
                destinationPath = Path.Combine(_monitoringSettings.ProcessedFolderPath, fileName);
            }

            File.Move(filePath, destinationPath);
            _logger.LogDebug("Arquivo movido para pasta processados: {DestinationPath}", destinationPath);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao mover arquivo para pasta processados: {FilePath}", filePath);
        }
    }

    private async Task DeleteFileAsync(string filePath)
    {
        try
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                _logger.LogDebug("Arquivo deletado: {FilePath}", filePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao deletar arquivo: {FilePath}", filePath);
        }
    }

    private async void ProcessQueueItems(object? state)
    {
        if (_isProcessingQueue)
            return;

        _isProcessingQueue = true;

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var queueService = scope.ServiceProvider.GetRequiredService<IQueueService>();
            var apiService = scope.ServiceProvider.GetRequiredService<IApiService>();

            // Processar itens pendentes na fila
            var processedCount = 0;
            const int maxItemsPerBatch = 10;

            while (processedCount < maxItemsPerBatch)
            {
                var queueItem = await queueService.DequeueNextItemAsync();
                if (queueItem == null)
                    break;

                try
                {
                    await queueService.MarkAsProcessingAsync(queueItem.Id);

                    var invoice = System.Text.Json.JsonSerializer.Deserialize<Models.DTOs.InvoiceDto>(queueItem.PayloadJson);
                    if (invoice == null)
                    {
                        await queueService.MarkAsErrorAsync(queueItem.Id, "Falha ao deserializar payload");
                        continue;
                    }

                    var response = await apiService.SendInvoiceAsync(invoice);

                    if (response.Success)
                    {
                        await queueService.MarkAsSentAsync(queueItem.Id, System.Text.Json.JsonSerializer.Serialize(response));
                        _logger.LogDebug("Item da fila enviado com sucesso: {ChaveNFe}", queueItem.ChaveNFe);
                    }
                    else
                    {
                        await queueService.MarkAsErrorAsync(queueItem.Id, response.Message ?? "Erro desconhecido");
                        _logger.LogWarning("Falha ao enviar item da fila: {ChaveNFe} - {Error}",
                            queueItem.ChaveNFe, response.Message);
                    }

                    processedCount++;
                }
                catch (Exception ex)
                {
                    await queueService.MarkAsErrorAsync(queueItem.Id, ex.Message);
                    _logger.LogError(ex, "Erro ao processar item da fila: {ChaveNFe}", queueItem.ChaveNFe);
                    processedCount++;
                }
            }

            if (processedCount > 0)
            {
                _logger.LogDebug("Processados {ProcessedCount} itens da fila", processedCount);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar fila");
        }
        finally
        {
            _isProcessingQueue = false;
        }
    }

    private static InvoiceData MapToInvoiceData(Models.DTOs.InvoiceDto dto, string? xmlHash)
    {
        var invoice = new InvoiceData
        {
            ChaveNFe = dto.ChaveNFe,
            MarketId = dto.MarketId,
            PdvId = dto.PdvId,
            Serie = dto.Serie,
            Numero = dto.Numero,
            DataEmissao = dto.DataEmissao,
            CnpjEmitente = dto.CnpjEmitente,
            CpfCnpjDestinatario = dto.CpfCnpjDestinatario,
            ValorTotal = dto.ValorTotal,
            NomeEmitente = dto.NomeEmitente,
            NomeDestinatario = dto.NomeDestinatario,
            MunicipioEmitente = dto.MunicipioEmitente,
            UfEmitente = dto.UfEmitente,
            MunicipioDestinatario = dto.MunicipioDestinatario,
            UfDestinatario = dto.UfDestinatario,
            ValorProdutos = dto.ValorProdutos,
            ValorIcms = dto.ValorIcms,
            ValorIpi = dto.ValorIpi,
            ValorPis = dto.ValorPis,
            ValorCofins = dto.ValorCofins,
            ValorDesconto = dto.ValorDesconto,
            ValorFrete = dto.ValorFrete,
            NaturezaOperacao = dto.NaturezaOperacao,
            TipoOperacao = dto.TipoOperacao,
            VersaoXml = dto.VersaoXml,
            TipoAmbiente = dto.TipoAmbiente,
            DataAutorizacao = dto.DataAutorizacao,
            ProtocoloAutorizacao = dto.ProtocoloAutorizacao,
            RawXmlHash = xmlHash,
            ProcessedAt = dto.ProcessedAt
        };

        // Mapear itens
        if (dto.Items != null)
        {
            foreach (var itemDto in dto.Items)
            {
                var item = new InvoiceItem
                {
                    InvoiceId = invoice.Id,
                    NumeroItem = itemDto.NumeroItem,
                    CodigoEAN = itemDto.CodigoEAN,
                    CodigoInterno = itemDto.CodigoInterno,
                    Descricao = itemDto.Descricao,
                    Ncm = itemDto.Ncm,
                    Cfop = itemDto.Cfop,
                    UnidadeComercial = itemDto.UnidadeComercial,
                    Quantidade = itemDto.Quantidade,
                    ValorUnitario = itemDto.ValorUnitario,
                    ValorTotal = itemDto.ValorTotal,
                    ValorDesconto = itemDto.ValorDesconto,
                    ValorIcms = itemDto.ValorIcms,
                    AliquotaIcms = itemDto.AliquotaIcms,
                    ValorIpi = itemDto.ValorIpi,
                    AliquotaIpi = itemDto.AliquotaIpi,
                    ValorPis = itemDto.ValorPis,
                    AliquotaPis = itemDto.AliquotaPis,
                    ValorCofins = itemDto.ValorCofins,
                    AliquotaCofins = itemDto.AliquotaCofins,
                    CstIcms = itemDto.CstIcms,
                    CstIpi = itemDto.CstIpi,
                    CstPis = itemDto.CstPis,
                    CstCofins = itemDto.CstCofins,
                    Marca = itemDto.Marca,
                    Categoria = itemDto.Categoria,
                    DataValidade = itemDto.DataValidade,
                    Lote = itemDto.Lote
                };

                invoice.Items.Add(item);
            }
        }

        // Mapear pagamentos
        if (dto.Payments != null)
        {
            foreach (var paymentDto in dto.Payments)
            {
                var payment = new PaymentInfo
                {
                    InvoiceId = invoice.Id,
                    FormaPagamento = paymentDto.FormaPagamento,
                    Valor = paymentDto.Valor,
                    MeioPagamento = paymentDto.MeioPagamento,
                    BandeiraCartao = paymentDto.BandeiraCartao,
                    NumeroAutorizacao = paymentDto.NumeroAutorizacao,
                    DataVencimento = paymentDto.DataVencimento
                };

                invoice.Payments.Add(payment);
            }
        }

        return invoice;
    }

    private void OnFileProcessingUpdate(object? sender, FileProcessingEventArgs e)
    {
        _logger.LogDebug("Status do arquivo atualizado: {FilePath} -> {Status}",
            Path.GetFileName(e.FilePath), e.Status);
    }

    private void OnMonitoringStatusChanged(object? sender, MonitoringStatusEventArgs e)
    {
        _logger.LogInformation("Status do monitoramento alterado: {Status} - {Message}",
            e.Status, e.Message);
    }

    private async Task LogProcessingError(string filePath, Exception ex)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<MercadoFlowContext>();

            var errorLog = new ErrorLog
            {
                Level = LogLevel.Error,
                Message = ex.Message,
                Exception = ex.ToString(),
                Source = nameof(FileProcessingService),
                Category = "FileProcessing",
                FilePath = filePath,
                MachineName = Environment.MachineName
            };

            context.ErrorLogs.Add(errorLog);
            await context.SaveChangesAsync();
        }
        catch (Exception logEx)
        {
            _logger.LogError(logEx, "Erro ao salvar log de erro no banco");
        }
    }

    private async Task CleanupAsync()
    {
        try
        {
            _queueProcessorTimer.Change(Timeout.Infinite, Timeout.Infinite);

            if (_fileMonitoringService != null)
            {
                _fileMonitoringService.FileDetected -= OnFileDetected;
                _fileMonitoringService.FileProcessingUpdate -= OnFileProcessingUpdate;
                _fileMonitoringService.StatusChanged -= OnMonitoringStatusChanged;

                await _fileMonitoringService.StopMonitoringAsync();
            }

            _processingSemaphore?.Dispose();
            _queueProcessorTimer?.Dispose();

            _logger.LogInformation("Serviço de processamento de arquivos finalizado");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro durante cleanup do serviço");
        }
    }

    public override void Dispose()
    {
        _processingSemaphore?.Dispose();
        _queueProcessorTimer?.Dispose();
        base.Dispose();
    }
}