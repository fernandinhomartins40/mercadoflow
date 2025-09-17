using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MercadoFlow.Desktop.Configuration;

namespace MercadoFlow.Desktop.Parsers;

public interface IZipFileProcessor
{
    Task<List<ZipExtractResult>> ExtractXmlFilesAsync(string zipFilePath);
    Task<List<ZipExtractResult>> ExtractXmlFilesAsync(Stream zipStream, string fileName);
    bool IsZipFile(string filePath);
}

public class ZipExtractResult
{
    public string FileName { get; set; } = string.Empty;
    public string XmlContent { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? OriginalPath { get; set; }
}

public class ZipFileProcessor : IZipFileProcessor
{
    private readonly ILogger<ZipFileProcessor> _logger;
    private readonly PerformanceSettings _performanceSettings;

    private static readonly string[] SupportedExtensions = { ".xml", ".XML" };
    private static readonly string[] UnsupportedFiles = { "Thumbs.db", ".DS_Store", "__MACOSX" };

    public ZipFileProcessor(
        ILogger<ZipFileProcessor> logger,
        IOptions<PerformanceSettings> performanceSettings)
    {
        _logger = logger;
        _performanceSettings = performanceSettings.Value;
    }

    public async Task<List<ZipExtractResult>> ExtractXmlFilesAsync(string zipFilePath)
    {
        var results = new List<ZipExtractResult>();

        try
        {
            if (!File.Exists(zipFilePath))
            {
                _logger.LogWarning("Arquivo ZIP não encontrado: {ZipFilePath}", zipFilePath);
                return results;
            }

            var fileInfo = new FileInfo(zipFilePath);
            if (fileInfo.Length > _performanceSettings.MaxQueueSize * 1024 * 1024) // Convert to bytes
            {
                _logger.LogWarning("Arquivo ZIP muito grande: {ZipFilePath} ({Size} bytes)",
                    zipFilePath, fileInfo.Length);
                return results;
            }

            using var fileStream = new FileStream(zipFilePath, FileMode.Open, FileAccess.Read);
            return await ExtractXmlFilesAsync(fileStream, Path.GetFileName(zipFilePath));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar arquivo ZIP: {ZipFilePath}", zipFilePath);
            return results;
        }
    }

    public async Task<List<ZipExtractResult>> ExtractXmlFilesAsync(Stream zipStream, string fileName)
    {
        var results = new List<ZipExtractResult>();

        try
        {
            using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);

            _logger.LogDebug("Processando arquivo ZIP {FileName} com {EntryCount} entradas",
                fileName, archive.Entries.Count);

            var xmlEntries = archive.Entries
                .Where(entry => !entry.FullName.EndsWith("/") && // Não é diretório
                               SupportedExtensions.Any(ext => entry.Name.EndsWith(ext, StringComparison.OrdinalIgnoreCase)) &&
                               !UnsupportedFiles.Any(unsupported => entry.Name.Contains(unsupported, StringComparison.OrdinalIgnoreCase)))
                .Take(_performanceSettings.BatchSize) // Limitar número de arquivos processados
                .ToList();

            if (!xmlEntries.Any())
            {
                _logger.LogWarning("Nenhum arquivo XML encontrado no ZIP: {FileName}", fileName);
                return results;
            }

            _logger.LogInformation("Encontrados {XmlCount} arquivos XML no ZIP {FileName}",
                xmlEntries.Count, fileName);

            foreach (var entry in xmlEntries)
            {
                var result = await ExtractSingleXmlAsync(entry, fileName);
                results.Add(result);

                if (!result.Success)
                {
                    _logger.LogWarning("Falha ao extrair {EntryName} do ZIP {FileName}: {Error}",
                        entry.Name, fileName, result.ErrorMessage);
                }
            }
        }
        catch (InvalidDataException ex)
        {
            _logger.LogError(ex, "Arquivo ZIP corrompido: {FileName}", fileName);
            results.Add(new ZipExtractResult
            {
                FileName = fileName,
                ErrorMessage = "Arquivo ZIP corrompido ou inválido",
                Success = false
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro inesperado ao processar ZIP: {FileName}", fileName);
            results.Add(new ZipExtractResult
            {
                FileName = fileName,
                ErrorMessage = $"Erro inesperado: {ex.Message}",
                Success = false
            });
        }

        return results;
    }

    public bool IsZipFile(string filePath)
    {
        try
        {
            if (!File.Exists(filePath))
                return false;

            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            if (extension != ".zip")
                return false;

            // Verificar magic number do ZIP
            using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
            var buffer = new byte[4];
            if (fileStream.Read(buffer, 0, 4) < 4)
                return false;

            // Magic number para ZIP: PK (0x504B)
            return buffer[0] == 0x50 && buffer[1] == 0x4B;
        }
        catch
        {
            return false;
        }
    }

    private async Task<ZipExtractResult> ExtractSingleXmlAsync(ZipArchiveEntry entry, string zipFileName)
    {
        var result = new ZipExtractResult
        {
            FileName = entry.Name,
            SizeBytes = entry.Length,
            OriginalPath = $"{zipFileName}/{entry.FullName}"
        };

        try
        {
            // Verificar tamanho do arquivo
            if (entry.Length > 50 * 1024 * 1024) // 50MB limit
            {
                result.ErrorMessage = "Arquivo XML muito grande";
                return result;
            }

            using var entryStream = entry.Open();
            using var reader = new StreamReader(entryStream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);

            result.XmlContent = await reader.ReadToEndAsync();

            if (string.IsNullOrWhiteSpace(result.XmlContent))
            {
                result.ErrorMessage = "Arquivo XML vazio";
                return result;
            }

            // Validação básica se é XML
            if (!result.XmlContent.TrimStart().StartsWith("<?xml") &&
                !result.XmlContent.TrimStart().StartsWith("<"))
            {
                result.ErrorMessage = "Conteúdo não parece ser XML válido";
                return result;
            }

            result.Success = true;
            _logger.LogDebug("XML extraído com sucesso: {FileName} ({Size} bytes)",
                entry.Name, entry.Length);
        }
        catch (Exception ex)
        {
            result.ErrorMessage = $"Erro ao extrair XML: {ex.Message}";
            _logger.LogError(ex, "Erro ao extrair {EntryName} do ZIP {ZipFileName}",
                entry.Name, zipFileName);
        }

        return result;
    }
}