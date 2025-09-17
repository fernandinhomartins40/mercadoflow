using System.Threading.Tasks;

namespace MercadoFlow.Desktop.Services;

public interface IEncryptionService
{
    Task<byte[]> EncryptAsync(string plainText);
    Task<string> DecryptAsync(byte[] cipherData);
    Task<string> EncryptStringAsync(string plainText);
    Task<string> DecryptStringAsync(string cipherText);
    Task<string> HashAsync(string input);
    Task<bool> VerifyHashAsync(string input, string hash);
    Task<string> GenerateSecureTokenAsync(int length = 32);
}