using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography.X509Certificates;

namespace MercadoFlow.Desktop.Services;

public class EncryptionService : IEncryptionService
{
    private readonly ILogger<EncryptionService> _logger;
    private readonly byte[] _entropy;

    public EncryptionService(ILogger<EncryptionService> logger)
    {
        _logger = logger;

        // Entropy adicional para DPAPI - baseado na máquina e aplicação
        var entropyString = $"MercadoFlow-{Environment.MachineName}-{Environment.UserName}";
        _entropy = SHA256.HashData(Encoding.UTF8.GetBytes(entropyString));
    }

    public async Task<byte[]> EncryptAsync(string plainText)
    {
        try
        {
            if (string.IsNullOrEmpty(plainText))
                throw new ArgumentException("Plain text cannot be null or empty", nameof(plainText));

            var plainBytes = Encoding.UTF8.GetBytes(plainText);

            // Usar DPAPI do Windows para criptografia segura baseada no usuário
            var encryptedBytes = await Task.Run(() =>
                System.Security.Cryptography.ProtectedData.Protect(
                    plainBytes,
                    _entropy,
                    System.Security.Cryptography.DataProtectionScope.CurrentUser));

            _logger.LogDebug("Dados criptografados com sucesso. Tamanho: {Size} bytes", encryptedBytes.Length);
            return encryptedBytes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criptografar dados");
            throw new InvalidOperationException("Falha na criptografia", ex);
        }
    }

    public async Task<string> DecryptAsync(byte[] cipherData)
    {
        try
        {
            if (cipherData == null || cipherData.Length == 0)
                throw new ArgumentException("Cipher data cannot be null or empty", nameof(cipherData));

            var decryptedBytes = await Task.Run(() =>
                System.Security.Cryptography.ProtectedData.Unprotect(
                    cipherData,
                    _entropy,
                    System.Security.Cryptography.DataProtectionScope.CurrentUser));

            var plainText = Encoding.UTF8.GetString(decryptedBytes);
            _logger.LogDebug("Dados descriptografados com sucesso. Tamanho: {Size} characters", plainText.Length);
            return plainText;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao descriptografar dados");
            throw new InvalidOperationException("Falha na descriptografia", ex);
        }
    }

    public async Task<string> EncryptStringAsync(string plainText)
    {
        var encryptedBytes = await EncryptAsync(plainText);
        return Convert.ToBase64String(encryptedBytes);
    }

    public async Task<string> DecryptStringAsync(string cipherText)
    {
        try
        {
            var cipherBytes = Convert.FromBase64String(cipherText);
            return await DecryptAsync(cipherBytes);
        }
        catch (FormatException ex)
        {
            _logger.LogError(ex, "Formato inválido de string criptografada");
            throw new ArgumentException("Invalid encrypted string format", nameof(cipherText), ex);
        }
    }

    public async Task<string> HashAsync(string input)
    {
        try
        {
            if (string.IsNullOrEmpty(input))
                throw new ArgumentException("Input cannot be null or empty", nameof(input));

            var inputBytes = Encoding.UTF8.GetBytes(input);
            var hashBytes = await Task.Run(() => SHA256.HashData(inputBytes));

            var hash = Convert.ToHexString(hashBytes).ToLowerInvariant();
            _logger.LogDebug("Hash gerado com sucesso");
            return hash;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar hash");
            throw;
        }
    }

    public async Task<bool> VerifyHashAsync(string input, string hash)
    {
        try
        {
            var inputHash = await HashAsync(input);
            var isValid = string.Equals(inputHash, hash, StringComparison.OrdinalIgnoreCase);

            _logger.LogDebug("Verificação de hash: {Result}", isValid ? "Válido" : "Inválido");
            return isValid;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar hash");
            return false;
        }
    }

    public async Task<string> GenerateSecureTokenAsync(int length = 32)
    {
        try
        {
            if (length <= 0)
                throw new ArgumentException("Length must be positive", nameof(length));

            var tokenBytes = new byte[length];
            await Task.Run(() => RandomNumberGenerator.Fill(tokenBytes));

            var token = Convert.ToBase64String(tokenBytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('='); // URL-safe base64

            _logger.LogDebug("Token seguro gerado com {Length} bytes", length);
            return token;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar token seguro");
            throw;
        }
    }

    // Método adicional para criptografia AES quando DPAPI não é suficiente
    public async Task<byte[]> EncryptAesAsync(string plainText, byte[] key, byte[]? iv = null)
    {
        try
        {
            if (string.IsNullOrEmpty(plainText))
                throw new ArgumentException("Plain text cannot be null or empty", nameof(plainText));

            if (key == null || key.Length != 32) // 256 bits
                throw new ArgumentException("Key must be 32 bytes (256 bits)", nameof(key));

            using var aes = Aes.Create();
            aes.Key = key;

            if (iv != null)
            {
                if (iv.Length != 16) // 128 bits
                    throw new ArgumentException("IV must be 16 bytes (128 bits)", nameof(iv));
                aes.IV = iv;
            }
            else
            {
                aes.GenerateIV();
            }

            var plainBytes = Encoding.UTF8.GetBytes(plainText);

            using var encryptor = aes.CreateEncryptor();
            var encryptedBytes = await Task.Run(() => encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length));

            // Combinar IV + dados criptografados
            var result = new byte[aes.IV.Length + encryptedBytes.Length];
            Array.Copy(aes.IV, 0, result, 0, aes.IV.Length);
            Array.Copy(encryptedBytes, 0, result, aes.IV.Length, encryptedBytes.Length);

            _logger.LogDebug("Dados criptografados com AES. Tamanho: {Size} bytes", result.Length);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criptografar com AES");
            throw;
        }
    }

    public async Task<string> DecryptAesAsync(byte[] cipherData, byte[] key)
    {
        try
        {
            if (cipherData == null || cipherData.Length < 16)
                throw new ArgumentException("Cipher data is too short", nameof(cipherData));

            if (key == null || key.Length != 32)
                throw new ArgumentException("Key must be 32 bytes (256 bits)", nameof(key));

            using var aes = Aes.Create();
            aes.Key = key;

            // Extrair IV (primeiros 16 bytes)
            var iv = new byte[16];
            Array.Copy(cipherData, 0, iv, 0, 16);
            aes.IV = iv;

            // Extrair dados criptografados
            var encryptedBytes = new byte[cipherData.Length - 16];
            Array.Copy(cipherData, 16, encryptedBytes, 0, encryptedBytes.Length);

            using var decryptor = aes.CreateDecryptor();
            var decryptedBytes = await Task.Run(() => decryptor.TransformFinalBlock(encryptedBytes, 0, encryptedBytes.Length));

            var plainText = Encoding.UTF8.GetString(decryptedBytes);
            _logger.LogDebug("Dados descriptografados com AES. Tamanho: {Size} characters", plainText.Length);
            return plainText;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao descriptografar com AES");
            throw;
        }
    }

    // Método para gerar chave derivada de senha
    public async Task<byte[]> DeriveKeyFromPasswordAsync(string password, byte[]? salt = null, int iterations = 100000)
    {
        try
        {
            if (string.IsNullOrEmpty(password))
                throw new ArgumentException("Password cannot be null or empty", nameof(password));

            salt ??= _entropy;

            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
            var key = await Task.Run(() => pbkdf2.GetBytes(32)); // 256 bits

            _logger.LogDebug("Chave derivada da senha com {Iterations} iterações", iterations);
            return key;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao derivar chave da senha");
            throw;
        }
    }

    // Método para gerar sal criptográfico
    public async Task<byte[]> GenerateSaltAsync(int size = 32)
    {
        try
        {
            var salt = new byte[size];
            await Task.Run(() => RandomNumberGenerator.Fill(salt));

            _logger.LogDebug("Sal gerado com {Size} bytes", size);
            return salt;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao gerar sal");
            throw;
        }
    }
}