namespace MercadoFlow.Desktop.Models;

public enum ProcessingStatus
{
    Pending = 0,
    Processing = 1,
    Completed = 2,
    Error = 3,
    Cancelled = 4,
    Retry = 5
}

public enum FileStatus
{
    Detected = 0,
    Reading = 1,
    Parsing = 2,
    Validating = 3,
    Queued = 4,
    Sending = 5,
    Sent = 6,
    Error = 7,
    Duplicate = 8,
    Ignored = 9
}

public enum ConnectivityStatus
{
    Unknown = 0,
    Connected = 1,
    Disconnected = 2,
    Connecting = 3,
    Error = 4
}

public enum ServiceStatus
{
    Stopped = 0,
    Starting = 1,
    Running = 2,
    Stopping = 3,
    Error = 4,
    Paused = 5
}

public enum LogLevel
{
    Trace = 0,
    Debug = 1,
    Information = 2,
    Warning = 3,
    Error = 4,
    Critical = 5
}

public enum AlertType
{
    Information = 0,
    Warning = 1,
    Error = 2,
    Critical = 3,
    Success = 4
}

public enum XmlVersion
{
    Unknown = 0,
    Version310 = 310,
    Version400 = 400
}

public enum DocumentType
{
    Unknown = 0,
    NFe = 1,
    NFCe = 2,
    CTe = 3,
    MDFe = 4
}

public enum Environment
{
    Production = 1,
    Homologation = 2
}

public enum OperationType
{
    Entrada = 0,
    Saida = 1
}