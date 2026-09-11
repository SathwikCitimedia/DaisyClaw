using DaisyClaw.Shared;

namespace DaisyClaw.Connection;

/// <summary>
/// Wraps <see cref="DaisyClawGatewayClient"/> behind <see cref="IGatewayClientLifecycle"/>.
/// Creates a real WebSocket-connected client instance.
/// </summary>
public sealed class GatewayClientFactory : IGatewayClientFactory
{
    public IGatewayClientLifecycle Create(
        string gatewayUrl,
        GatewayCredential credential,
        string identityPath,
        IDaisyClawLogger logger)
    {
        var client = new DaisyClawGatewayClient(
            gatewayUrl,
            credential.Token,
            logger,
            tokenIsBootstrapToken: credential.IsBootstrapToken,
            bootstrapPairAsNode: false,
            identityPath: identityPath,
            ignoreStoredDeviceToken: credential.IsBootstrapToken,
            assistantMediaAuthToken: credential.InteractiveHttpToken);

        return new GatewayClientLifecycleAdapter(client);
    }
}

/// <summary>
/// Adapts <see cref="DaisyClawGatewayClient"/> (which inherits from
/// <see cref="WebSocketClientBase"/>) to the <see cref="IGatewayClientLifecycle"/> interface.
/// </summary>
internal sealed class GatewayClientLifecycleAdapter : IGatewayClientLifecycle
{
    private readonly DaisyClawGatewayClient _client;

    public GatewayClientLifecycleAdapter(DaisyClawGatewayClient client)
    {
        _client = client;
        // Forward events from WebSocketClientBase
        _client.StatusChanged += (s, e) => StatusChanged?.Invoke(this, e);
        _client.AuthenticationFailed += (s, e) => AuthenticationFailed?.Invoke(this, e);
    }

    public DaisyClawGatewayClient DataClient => _client;

    public event EventHandler<ConnectionStatus>? StatusChanged;
    public event EventHandler<string>? AuthenticationFailed;

    public Task ConnectAsync(CancellationToken ct) => _client.ConnectAsync();

    public void Dispose() => _client.Dispose();
}
