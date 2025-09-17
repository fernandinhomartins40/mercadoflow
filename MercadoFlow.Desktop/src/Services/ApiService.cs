using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;
using MercadoFlow.Desktop.Configuration;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Models.DTOs;

namespace MercadoFlow.Desktop.Services;

public class ApiService : IApiService, IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ApiService> _logger;
    private readonly ApiSettings _apiSettings;
    private readonly SecuritySettings _securitySettings;
    private readonly IAsyncPolicy<HttpResponseMessage> _retryPolicy;
    private readonly ApiStatistics _statistics = new();
    private readonly object _lockObject = new();

    private ConnectivityStatus _currentStatus = ConnectivityStatus.Unknown;
    private DateTime _lastHealthCheck = DateTime.MinValue;
    private readonly Timer _healthCheckTimer;
    private bool _disposed;

    public event EventHandler<ConnectivityStatusEventArgs>? ConnectivityChanged;

    public ApiService(
        HttpClient httpClient,
        ILogger<ApiService> logger,
        IOptions<ApiSettings> apiSettings,
        IOptions<SecuritySettings> securitySettings)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiSettings = apiSettings.Value;
        _securitySettings = securitySettings.Value;

        ConfigureHttpClient();
        _retryPolicy = CreateRetryPolicy();

        // Configurar timer para health check
        _healthCheckTimer = new Timer(PerformHealthCheck, null, TimeSpan.Zero, TimeSpan.FromMinutes(5));

        _logger.LogInformation("ApiService inicializado para {BaseUrl}", _apiSettings.BaseUrl);
    }

    public async Task<ApiResponse<InvoiceProcessingResponse>> SendInvoiceAsync(InvoiceDto invoice, CancellationToken cancellationToken = default)
    {
        if (invoice == null)
            throw new ArgumentNullException(nameof(invoice));

        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogDebug("Enviando invoice: {ChaveNFe}", invoice.ChaveNFe);

            var json = JsonSerializer.Serialize(invoice, CreateJsonOptions());
            var content = CreateHttpContent(json);

            var requestUri = $"{_apiSettings.BaseUrl.TrimEnd('/')}{_apiSettings.IngestEndpoint}";

            var response = await _retryPolicy.ExecuteAsync(async () =>
            {
                var httpResponse = await _httpClient.PostAsync(requestUri, content, cancellationToken);
                LogHttpResponse(httpResponse);
                return httpResponse;
            });

            stopwatch.Stop();
            UpdateStatistics(true, stopwatch.Elapsed, (int)response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<ApiResponse<InvoiceProcessingResponse>>(responseContent, CreateJsonOptions());

                _logger.LogInformation("Invoice enviada com sucesso: {ChaveNFe} em {ElapsedMs}ms",
                    invoice.ChaveNFe, stopwatch.ElapsedMilliseconds);

                return result ?? new ApiResponse<InvoiceProcessingResponse>
                {
                    Success = true,
                    Message = "Invoice processada com sucesso"
                };
            }
            else
            {
                _logger.LogWarning("Falha ao enviar invoice: {ChaveNFe} - Status: {StatusCode}",
                    invoice.ChaveNFe, response.StatusCode);

                return new ApiResponse<InvoiceProcessingResponse>
                {
                    Success = false,
                    Message = $"Erro HTTP {response.StatusCode}: {response.ReasonPhrase}",
                    Errors = new List<string> { responseContent }
                };
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Envio de invoice cancelado: {ChaveNFe}", invoice.ChaveNFe);
            stopwatch.Stop();
            UpdateStatistics(false, stopwatch.Elapsed, 0);

            return new ApiResponse<InvoiceProcessingResponse>
            {
                Success = false,
                Message = "Operação cancelada"
            };
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            _logger.LogError("Timeout ao enviar invoice: {ChaveNFe}", invoice.ChaveNFe);
            stopwatch.Stop();
            UpdateStatistics(false, stopwatch.Elapsed, 0, isTimeout: true);

            return new ApiResponse<InvoiceProcessingResponse>
            {
                Success = false,
                Message = "Timeout na requisição"
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Erro de conectividade ao enviar invoice: {ChaveNFe}", invoice.ChaveNFe);
            stopwatch.Stop();
            UpdateStatistics(false, stopwatch.Elapsed, 0);
            UpdateConnectivityStatus(ConnectivityStatus.Disconnected, ex.Message, ex);

            return new ApiResponse<InvoiceProcessingResponse>
            {
                Success = false,
                Message = $"Erro de conectividade: {ex.Message}"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao enviar invoice: {ChaveNFe}", invoice.ChaveNFe);
            stopwatch.Stop();
            UpdateStatistics(false, stopwatch.Elapsed, 0);

            return new ApiResponse<InvoiceProcessingResponse>
            {
                Success = false,
                Message = $"Erro inesperado: {ex.Message}"
            };
        }
    }

    public async Task<ApiResponse<BatchProcessingResponse>> SendBatchAsync(List<InvoiceDto> invoices, CancellationToken cancellationToken = default)
    {
        if (invoices == null || !invoices.Any())
            throw new ArgumentException("Lista de invoices não pode ser vazia", nameof(invoices));

        var stopwatch = Stopwatch.StartNew();

        try
        {
            _logger.LogDebug("Enviando batch com {Count} invoices", invoices.Count);

            var batchRequest = new
            {
                Invoices = invoices,
                Timestamp = DateTime.UtcNow,
                BatchId = Guid.NewGuid().ToString(),
                TotalCount = invoices.Count
            };

            var json = JsonSerializer.Serialize(batchRequest, CreateJsonOptions());
            var content = CreateHttpContent(json);

            var requestUri = $"{_apiSettings.BaseUrl.TrimEnd('/')}{_apiSettings.BatchEndpoint}";

            var response = await _retryPolicy.ExecuteAsync(async () =>
            {
                var httpResponse = await _httpClient.PostAsync(requestUri, content, cancellationToken);
                LogHttpResponse(httpResponse);
                return httpResponse;
            });

            stopwatch.Stop();
            UpdateStatistics(true, stopwatch.Elapsed, (int)response.StatusCode);

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<ApiResponse<BatchProcessingResponse>>(responseContent, CreateJsonOptions());

                _logger.LogInformation("Batch enviado com sucesso: {Count} invoices em {ElapsedMs}ms",
                    invoices.Count, stopwatch.ElapsedMilliseconds);

                return result ?? new ApiResponse<BatchProcessingResponse>
                {
                    Success = true,
                    Message = "Batch processado com sucesso"
                };
            }
            else
            {
                _logger.LogWarning("Falha ao enviar batch: {Count} invoices - Status: {StatusCode}",
                    invoices.Count, response.StatusCode);

                return new ApiResponse<BatchProcessingResponse>
                {
                    Success = false,
                    Message = $"Erro HTTP {response.StatusCode}: {response.ReasonPhrase}",
                    Errors = new List<string> { responseContent }
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar batch com {Count} invoices", invoices.Count);
            stopwatch.Stop();
            UpdateStatistics(false, stopwatch.Elapsed, 0);

            return new ApiResponse<BatchProcessingResponse>
            {
                Success = false,
                Message = $"Erro inesperado: {ex.Message}"
            };
        }
    }

    public async Task<ApiResponse<HealthCheckResponse>> HealthCheckAsync(CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var requestUri = $"{_apiSettings.BaseUrl.TrimEnd('/')}{_apiSettings.HealthCheckEndpoint}";

            var response = await _httpClient.GetAsync(requestUri, cancellationToken);
            stopwatch.Stop();

            LogHttpResponse(response);

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var healthResponse = JsonSerializer.Deserialize<HealthCheckResponse>(responseContent, CreateJsonOptions());

                UpdateConnectivityStatus(ConnectivityStatus.Connected, "API disponível");
                _lastHealthCheck = DateTime.UtcNow;

                return new ApiResponse<HealthCheckResponse>
                {
                    Success = true,
                    Data = healthResponse,
                    Message = "API disponível"
                };
            }
            else
            {
                UpdateConnectivityStatus(ConnectivityStatus.Error, $"API retornou status {response.StatusCode}");

                return new ApiResponse<HealthCheckResponse>
                {
                    Success = false,
                    Message = $"Health check falhou: {response.StatusCode}"
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Health check falhou");
            stopwatch.Stop();
            UpdateConnectivityStatus(ConnectivityStatus.Disconnected, ex.Message, ex);

            return new ApiResponse<HealthCheckResponse>
            {
                Success = false,
                Message = $"Erro no health check: {ex.Message}"
            };
        }
    }

    public async Task<bool> TestConnectionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var healthResult = await HealthCheckAsync(cancellationToken);
            return healthResult.Success;
        }
        catch
        {
            return false;
        }
    }

    public ConnectivityStatus GetConnectionStatus()
    {
        return _currentStatus;
    }

    public ApiStatistics GetStatistics()
    {
        lock (_lockObject)
        {
            _statistics.CurrentStatus = _currentStatus;
            return _statistics;
        }
    }

    private void ConfigureHttpClient()
    {
        _httpClient.BaseAddress = new Uri(_apiSettings.BaseUrl);
        _httpClient.Timeout = _apiSettings.Timeout;

        // Headers padrão
        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", _apiSettings.UserAgent);
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

        if (_apiSettings.EnableCompression)
        {
            _httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate");
        }

        // API Key
        if (!string.IsNullOrWhiteSpace(_apiSettings.ApiKey))
        {
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiSettings.ApiKey}");
        }

        // Market ID
        if (!string.IsNullOrWhiteSpace(_apiSettings.MarketId))
        {
            _httpClient.DefaultRequestHeaders.Add("X-Market-ID", _apiSettings.MarketId);
        }

        // Headers adicionais
        foreach (var header in _apiSettings.Headers)
        {
            _httpClient.DefaultRequestHeaders.Add(header.Key, header.Value);
        }

        // Configurar validação de certificados
        if (!_securitySettings.ValidateCertificates)
        {
            var handler = new HttpClientHandler();
            handler.ServerCertificateCustomValidationCallback = (sender, cert, chain, sslPolicyErrors) => true;
        }
    }

    private IAsyncPolicy<HttpResponseMessage> CreateRetryPolicy()
    {
        var retryPolicy = Policy
            .Handle<HttpRequestException>()
            .Or<TaskCanceledException>()
            .OrResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode && IsRetriableStatusCode(r.StatusCode))
            .WaitAndRetryAsync(
                retryCount: _apiSettings.RetryAttempts,
                sleepDurationProvider: retryAttempt =>
                {
                    if (retryAttempt <= _apiSettings.RetryDelays.Count)
                    {
                        return _apiSettings.RetryDelays[retryAttempt - 1];
                    }
                    return TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)); // Exponential backoff
                },
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    var exception = outcome.Exception;
                    var response = outcome.Result;

                    if (exception != null)
                    {
                        _logger.LogWarning("Tentativa {RetryCount}/{MaxRetries} falhou com exceção: {Exception}. Tentando novamente em {Delay}s",
                            retryCount, _apiSettings.RetryAttempts, exception.Message, timespan.TotalSeconds);
                    }
                    else if (response != null)
                    {
                        _logger.LogWarning("Tentativa {RetryCount}/{MaxRetries} falhou com status {StatusCode}. Tentando novamente em {Delay}s",
                            retryCount, _apiSettings.RetryAttempts, response.StatusCode, timespan.TotalSeconds);
                    }

                    lock (_lockObject)
                    {
                        _statistics.RetryRequests++;
                    }
                });

        return retryPolicy;
    }

    private static bool IsRetriableStatusCode(HttpStatusCode statusCode)
    {
        return statusCode switch
        {
            HttpStatusCode.RequestTimeout => true,
            HttpStatusCode.TooManyRequests => true,
            HttpStatusCode.InternalServerError => true,
            HttpStatusCode.BadGateway => true,
            HttpStatusCode.ServiceUnavailable => true,
            HttpStatusCode.GatewayTimeout => true,
            _ => false
        };
    }

    private HttpContent CreateHttpContent(string json)
    {
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        if (_apiSettings.EnableCompression)
        {
            // Comprimir conteúdo se for grande
            if (json.Length > 1024) // Apenas comprimir se > 1KB
            {
                var compressedBytes = CompressString(json);
                content = new ByteArrayContent(compressedBytes);
                content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
                content.Headers.ContentEncoding.Add("gzip");
            }
        }

        return content;
    }

    private static byte[] CompressString(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        using var output = new System.IO.MemoryStream();
        using (var gzip = new GZipStream(output, CompressionLevel.Optimal))
        {
            gzip.Write(bytes, 0, bytes.Length);
        }
        return output.ToArray();
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        return new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };
    }

    private void LogHttpResponse(HttpResponseMessage response)
    {
        var statusCode = (int)response.StatusCode;
        var method = response.RequestMessage?.Method.Method ?? "UNKNOWN";
        var url = response.RequestMessage?.RequestUri?.ToString() ?? "UNKNOWN";

        if (response.IsSuccessStatusCode)
        {
            _logger.LogDebug("HTTP {Method} {Url} -> {StatusCode} {ReasonPhrase}",
                method, url, statusCode, response.ReasonPhrase);
        }
        else
        {
            _logger.LogWarning("HTTP {Method} {Url} -> {StatusCode} {ReasonPhrase}",
                method, url, statusCode, response.ReasonPhrase);
        }
    }

    private void UpdateStatistics(bool success, TimeSpan responseTime, int statusCode, bool isTimeout = false)
    {
        lock (_lockObject)
        {
            _statistics.TotalRequests++;

            if (success)
            {
                _statistics.SuccessfulRequests++;
                _statistics.LastSuccessfulRequest = DateTime.UtcNow;
                UpdateConnectivityStatus(ConnectivityStatus.Connected, "Última requisição bem-sucedida");
            }
            else
            {
                _statistics.FailedRequests++;
                _statistics.LastFailedRequest = DateTime.UtcNow;

                if (isTimeout)
                {
                    _statistics.TimeoutRequests++;
                }
            }

            if (statusCode > 0)
            {
                _statistics.ResponseCodeCounts.TryGetValue(statusCode, out var count);
                _statistics.ResponseCodeCounts[statusCode] = count + 1;
            }

            // Calcular tempo médio de resposta (média móvel simples)
            var totalMs = _statistics.AverageResponseTime.TotalMilliseconds * Math.Max(1, _statistics.TotalRequests - 1);
            totalMs += responseTime.TotalMilliseconds;
            _statistics.AverageResponseTime = TimeSpan.FromMilliseconds(totalMs / _statistics.TotalRequests);
        }
    }

    private void UpdateConnectivityStatus(ConnectivityStatus newStatus, string? message = null, Exception? exception = null)
    {
        if (_currentStatus == newStatus)
            return;

        var previousStatus = _currentStatus;
        _currentStatus = newStatus;

        _logger.LogInformation("Status de conectividade alterado: {PreviousStatus} -> {NewStatus}",
            previousStatus, newStatus);

        ConnectivityChanged?.Invoke(this, new ConnectivityStatusEventArgs
        {
            Status = newStatus,
            Message = message,
            Exception = exception
        });
    }

    private async void PerformHealthCheck(object? state)
    {
        try
        {
            // Executar health check apenas se não foi feito recentemente
            if (DateTime.UtcNow - _lastHealthCheck < TimeSpan.FromMinutes(2))
                return;

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            await HealthCheckAsync(cts.Token);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Health check automático falhou");
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;

        try
        {
            _healthCheckTimer?.Dispose();
            _httpClient?.Dispose();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao fazer dispose do ApiService");
        }
    }
}