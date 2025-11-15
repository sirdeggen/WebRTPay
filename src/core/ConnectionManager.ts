/**
 * High-level connection manager
 * Orchestrates WebRTC connection, bootstrapping, and message protocol
 */

import { WebRTCConnection } from './WebRTCConnection';
import { QRBootstrap } from '../bootstrap/QRBootstrap';
import { RemoteBootstrap } from '../bootstrap/RemoteBootstrap';
import { MessageProtocol, registerCommonSchemas } from '../protocol/MessageProtocol';
import {
  BootstrapToken,
  WebRTCConfig,
  RemoteBootstrapConfig,
  ConnectionState,
  ConnectionEvent,
  PaymentMessage,
  ErrorType,
  WebRTPayError
} from './types';

/**
 * Connection manager configuration
 */
export interface ConnectionManagerConfig {
  /** WebRTC configuration */
  webrtc?: WebRTCConfig;
  /** Remote bootstrap configuration (optional) */
  remote?: RemoteBootstrapConfig;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Enable automatic retry on connection failure */
  autoRetry?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * Connection establishment options
 */
export interface ConnectionOptions {
  /** Method: 'qr' or 'remote' */
  method: 'qr' | 'remote';
  /** Username for remote method */
  username?: string;
  /** Bootstrap token for direct connection */
  token?: BootstrapToken;
}

export class ConnectionManager {
  private readonly connection: WebRTCConnection;
  private readonly protocol: MessageProtocol;
  private readonly remoteBootstrap?: RemoteBootstrap;
  private readonly config: ConnectionManagerConfig;
  private retryCount: number = 0;

  constructor(config: ConnectionManagerConfig = {}) {
    this.config = {
      connectionTimeout: 30000,
      autoRetry: true,
      maxRetries: 3,
      ...config
    };

    this.connection = new WebRTCConnection(config.webrtc);

    this.protocol = new MessageProtocol();
    registerCommonSchemas(this.protocol);

    if (config.remote) {
      this.remoteBootstrap = new RemoteBootstrap(config.remote);
    }

    this.setupConnectionHandlers();
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.connection.on(ConnectionEvent.STATE_CHANGE, ({ state }) => {
      console.log('Connection state changed:', state);

      if (state === ConnectionState.FAILED && this.config.autoRetry) {
        this.handleConnectionFailure();
      }
    });

    this.connection.on(ConnectionEvent.MESSAGE_RECEIVED, async ({ data }) => {
      try {
        await this.protocol.processMessage(data as PaymentMessage);
      } catch (error) {
        console.error('Failed to process message:', error);
      }
    });

    this.connection.on(ConnectionEvent.DATA_CHANNEL_OPEN, () => {
      console.log('Data channel ready');

      // Retry any queued messages
      this.protocol.retryQueuedMessages((msg) => this.sendMessage(msg));
    });

    this.connection.on(ConnectionEvent.ERROR, ({ error }) => {
      console.error('Connection error:', error);
    });
  }

  /**
   * Handle connection failure with retry logic
   */
  private async handleConnectionFailure(): Promise<void> {
    if (this.retryCount >= (this.config.maxRetries || 3)) {
      console.error('Max retries exceeded');
      return;
    }

    this.retryCount++;
    console.log(`Retrying connection (attempt ${this.retryCount})...`);

    // Wait before retry with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry logic would go here
    // For now, just log
    console.log('Retry logic not yet implemented');
  }

  /**
   * Create connection as offerer and generate QR code
   * Uses trickle ICE by default (single QR code, answer via data channel)
   * @param useTrickleICE - Use trickle ICE mode (default true)
   */
  public async createQRConnection(useTrickleICE: boolean = true): Promise<{
    token: BootstrapToken;
    qrCodeDataUrl: string;
    qrCodeSVG: string;
    isTrickleICE: boolean;
  }> {
    try {
      // Create bootstrap token with trickle ICE (includes minimal ICE candidates)
      const token = await this.connection.createBootstrapToken(useTrickleICE);

      // Generate QR code with offer + initial ICE candidates
      const qrCodeDataUrl = await QRBootstrap.generateQRCode(token);
      const qrCodeSVG = await QRBootstrap.generateQRCodeSVG(token);

      return {
        token,
        qrCodeDataUrl,
        qrCodeSVG,
        isTrickleICE: useTrickleICE
      };
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_GENERATION_FAILED,
        'Failed to create QR connection',
        error
      );
    }
  }

  /**
   * Join connection by scanning QR code
   * In trickle ICE mode, returns null (answer sent via data channel)
   * In traditional mode, returns answer QR code that needs to be shown to the offerer
   */
  public async joinQRConnection(token: BootstrapToken): Promise<{
    answer: RTCSessionDescriptionInit;
    iceCandidates: RTCIceCandidateInit[];
    answerQRCode: string;
    isTrickleICE: boolean;
  } | {
    isTrickleICE: boolean;
    answer?: never;
    iceCandidates?: never;
    answerQRCode?: never;
  }> {
    try {
      // Validate token
      if (!QRBootstrap.validateToken(token)) {
        throw new WebRTPayError(
          ErrorType.BOOTSTRAP_PARSE_FAILED,
          'Invalid bootstrap token'
        );
      }

      // Check if token is expired
      if (QRBootstrap.isTokenExpired(token)) {
        throw new WebRTPayError(
          ErrorType.TIMEOUT,
          'Bootstrap token has expired'
        );
      }

      // Connect using token and get answer (if not trickle ICE)
      console.log('>>> joinQRConnection: calling connectWithBootstrapToken');
      const result = await this.connection.connectWithBootstrapToken(token);
      console.log('>>> joinQRConnection: result from connectWithBootstrapToken:', result);

      if (result === null) {
        // Trickle ICE mode - answer will be sent via data channel
        console.log('>>> Trickle ICE mode detected');
        return {
          isTrickleICE: true
        };
      } else {
        // Traditional mode - generate QR code for the answer
        console.log('>>> Traditional mode: generating answer QR');
        const { answer, iceCandidates } = result;
        console.log('>>> Answer:', answer);
        console.log('>>> ICE candidates:', iceCandidates);

        const answerToken = {
          a: answer,
          i: iceCandidates
        };
        console.log('>>> Answer token to encode:', answerToken);

        const answerQRCode = await QRBootstrap.generateQRCode(answerToken as any);
        console.log('>>> Answer QR code generated');

        return {
          answer,
          iceCandidates,
          answerQRCode,
          isTrickleICE: false
        };
      }
    } catch (error) {
      console.error('>>> ERROR in joinQRConnection:', error);
      console.error('>>> Error details:', (error as any).message, (error as any).stack);
      throw new WebRTPayError(
        ErrorType.CONNECTION_FAILED,
        'Failed to join QR connection',
        error
      );
    }
  }

  /**
   * Complete QR connection by scanning answer (offerer side)
   */
  public async completeQRConnection(answerToken: {
    a: RTCSessionDescriptionInit;
    i: RTCIceCandidateInit[];
  }): Promise<void> {
    try {
      await this.connection.receiveAnswer(answerToken.a, answerToken.i);
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.CONNECTION_FAILED,
        'Failed to complete QR connection',
        error
      );
    }
  }

  /**
   * Publish connection to remote broadcaster
   */
  public async publishRemoteConnection(username: string): Promise<{
    token: BootstrapToken;
    publishResponse: any;
  }> {
    if (!this.remoteBootstrap) {
      throw new WebRTPayError(
        ErrorType.REMOTE_SERVICE_ERROR,
        'Remote bootstrap not configured'
      );
    }

    try {
      // Create bootstrap token
      const token = await this.connection.createBootstrapToken();

      // Publish to broadcaster
      const publishResponse = await this.remoteBootstrap.publishToken(
        username,
        token
      );

      return {
        token,
        publishResponse
      };
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.REMOTE_SERVICE_ERROR,
        'Failed to publish remote connection',
        error
      );
    }
  }

  /**
   * Lookup and join remote connection
   */
  public async joinRemoteConnection(username: string): Promise<void> {
    if (!this.remoteBootstrap) {
      throw new WebRTPayError(
        ErrorType.REMOTE_SERVICE_ERROR,
        'Remote bootstrap not configured'
      );
    }

    try {
      // Lookup token
      const lookupResponse = await this.remoteBootstrap.lookupToken(username);

      if (!lookupResponse.found || !lookupResponse.token) {
        throw new WebRTPayError(
          ErrorType.REMOTE_SERVICE_ERROR,
          `No connection found for username: ${username}`
        );
      }

      // Connect using token
      await this.connection.connectWithBootstrapToken(lookupResponse.token);
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.REMOTE_SERVICE_ERROR,
        'Failed to join remote connection',
        error
      );
    }
  }

  /**
   * Send message through connection
   */
  public async sendMessage(message: PaymentMessage): Promise<void> {
    if (!this.connection.isReady()) {
      // Queue message for later
      this.protocol.queueMessage(message);
      throw new WebRTPayError(
        ErrorType.MESSAGE_SEND_FAILED,
        'Connection not ready, message queued'
      );
    }

    try {
      await this.connection.sendMessage(message);
    } catch (error) {
      // Queue for retry
      this.protocol.queueMessage(message);
      throw error;
    }
  }

  /**
   * Create and send message
   */
  public async send(type: string, payload: unknown): Promise<void> {
    const message = this.protocol.createMessage(type, payload);
    await this.sendMessage(message);
  }

  /**
   * Register message handler
   */
  public onMessage(
    messageType: string,
    handler: (message: PaymentMessage) => void | Promise<void>
  ): void {
    this.protocol.on(messageType, handler);
  }

  /**
   * Unregister message handler
   */
  public offMessage(
    messageType: string,
    handler: (message: PaymentMessage) => void | Promise<void>
  ): void {
    this.protocol.off(messageType, handler);
  }

  /**
   * Register handler for all message types
   */
  public onAnyMessage(
    handler: (message: PaymentMessage) => void | Promise<void>
  ): void {
    this.protocol.onAny(handler);
  }

  /**
   * Get connection state
   */
  public getState(): ConnectionState {
    return this.connection.getState();
  }

  /**
   * Check if connection is ready
   */
  public isReady(): boolean {
    return this.connection.isReady();
  }

  /**
   * Get connection ID
   */
  public getConnectionId(): string {
    return this.connection.getConnectionId();
  }

  /**
   * Get message history
   */
  public getMessageHistory(messageType?: string): PaymentMessage[] {
    return this.protocol.getHistory(messageType);
  }

  /**
   * Get connection statistics
   */
  public async getStats(): Promise<{
    connection: RTCStatsReport | null;
    protocol: any;
  }> {
    return {
      connection: await this.connection.getStats(),
      protocol: this.protocol.getStats()
    };
  }

  /**
   * Close connection and cleanup
   */
  public close(): void {
    this.connection.close();
    this.protocol.clearHistory();
    this.protocol.clearQueue();
    this.retryCount = 0;
  }

  /**
   * Get protocol instance for advanced usage
   */
  public getProtocol(): MessageProtocol {
    return this.protocol;
  }

  /**
   * Get connection instance for advanced usage
   */
  public getConnection(): WebRTCConnection {
    return this.connection;
  }

  /**
   * Get remote bootstrap instance
   */
  public getRemoteBootstrap(): RemoteBootstrap | undefined {
    return this.remoteBootstrap;
  }
}

/**
 * Create ConnectionManager instance
 */
export function createConnectionManager(
  config?: ConnectionManagerConfig
): ConnectionManager {
  return new ConnectionManager(config);
}
