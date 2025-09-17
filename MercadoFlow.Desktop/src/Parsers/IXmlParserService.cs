using System.Threading.Tasks;
using MercadoFlow.Desktop.Models;
using MercadoFlow.Desktop.Models.DTOs;

namespace MercadoFlow.Desktop.Parsers;

public interface IXmlParserService
{
    Task<ParsingResult> ParseXmlAsync(string xmlContent, string fileName);
    Task<ParsingResult> ParseXmlFileAsync(string filePath);
    Task<ValidationResult> ValidateXmlAsync(string xmlContent);
    bool IsValidNFeXml(string xmlContent);
    XmlVersion DetectXmlVersion(string xmlContent);
    DocumentType DetectDocumentType(string xmlContent);
}

public class ParsingResult
{
    public bool Success { get; set; }
    public InvoiceDto? InvoiceData { get; set; }
    public string? ErrorMessage { get; set; }
    public List<string> Warnings { get; set; } = new();
    public XmlVersion Version { get; set; }
    public DocumentType DocumentType { get; set; }
    public string FileName { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public TimeSpan ProcessingTime { get; set; }
    public string? RawXmlHash { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public List<ValidationError> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public bool HasValidSignature { get; set; }
    public bool PassedSchemaValidation { get; set; }
    public string? SchemaVersion { get; set; }
}