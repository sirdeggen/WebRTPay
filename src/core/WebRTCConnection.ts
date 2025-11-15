/**
 * Core WebRTC connection manager
 * Handles peer connection lifecycle, ICE negotiation, and data channel management
 */

import {
  BootstrapToken,
  WebRTCConfig,
  ConnectionState,
  ConnectionEvent,
  ConnectionEventMap,
  EventListener,
  ConnectionRole,
  ErrorType,
  WebRTPayError,
  PaymentMessage
} from './types';

/**
 * Default WebRTC configuration with public STUN servers
 */
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'balanced'
};

export class WebRTCConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private state: ConnectionState = ConnectionState.IDLE;
  private role: ConnectionRole | null = null;
  private eventListeners: Map<ConnectionEvent, Set<EventListener<any>>> = new Map();
  private iceCandidatesBuffer: RTCIceCandidate[] = [];
  private connectionId: string;

  constructor(
    private config: WebRTCConfig = DEFAULT_WEBRTC_CONFIG
  ) {
    this.connectionId = this.generateConnectionId();
  }

  /**
   * Generate unique connection identifier
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connection ID
   */
  public getConnectionId(): string {
    return this.connectionId;
  }

  /**
   * Register event listener
   */
  public on<T extends ConnectionEvent>(
    event: T,
    listener: EventListener<T>
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public off<T extends ConnectionEvent>(
    event: T,
    listener: EventListener<T>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event to all registered listeners
   */
  private emit<T extends ConnectionEvent>(
    event: T,
    payload: ConnectionEventMap[T]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Update connection state and emit event
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit(ConnectionEvent.STATE_CHANGE, { state: newState });
    }
  }

  /**
   * Initialize peer connection with ICE server configuration
   */
  private initializePeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const pc = new RTCPeerConnection(this.config);

    // Handle ICE candidate events
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.iceCandidatesBuffer.push(event.candidate);
        this.emit(ConnectionEvent.ICE_CANDIDATE, { candidate: event.candidate });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connected':
          this.setState(ConnectionState.CONNECTED);
          break;
        case 'disconnected':
          this.setState(ConnectionState.DISCONNECTED);
          break;
        case 'failed':
          this.setState(ConnectionState.FAILED);
          this.emit(ConnectionEvent.ERROR, {
            error: new WebRTPayError(
              ErrorType.CONNECTION_FAILED,
              'WebRTC connection failed'
            )
          });
          break;
        case 'closed':
          this.setState(ConnectionState.CLOSED);
          break;
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        this.emit(ConnectionEvent.ERROR, {
          error: new WebRTPayError(
            ErrorType.ICE_FAILED,
            'ICE connection failed - check STUN/TURN configuration'
          )
        });
      }
    };

    // Handle incoming data channels (answerer side)
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    this.peerConnection = pc;
    return pc;
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('Data channel opened');
      this.emit(ConnectionEvent.DATA_CHANNEL_OPEN, { channel });
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      this.emit(ConnectionEvent.DATA_CHANNEL_CLOSE, { channel });
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit(ConnectionEvent.ERROR, {
        error: new WebRTPayError(
          ErrorType.DATA_CHANNEL_FAILED,
          'Data channel error',
          error
        )
      });
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(ConnectionEvent.MESSAGE_RECEIVED, { data });
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.emit(ConnectionEvent.ERROR, {
          error: new WebRTPayError(
            ErrorType.MESSAGE_SEND_FAILED,
            'Failed to parse incoming message',
            error
          )
        });
      }
    };
  }

  /**
   * Create bootstrap token as offerer
   * This generates the QR code payload or remote broadcast token
   */
  public async createBootstrapToken(): Promise<BootstrapToken> {
    try {
      this.role = ConnectionRole.OFFERER;
      this.setState(ConnectionState.CREATING_OFFER);

      const pc = this.initializePeerConnection();

      // Create data channel (offerer creates it)
      const channel = pc.createDataChannel('payment-channel', {
        ordered: true,
        maxRetransmits: 3
      });
      this.setupDataChannel(channel);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete or timeout
      await this.waitForICEGathering(pc, 5000);

      this.setState(ConnectionState.AWAITING_ANSWER);

      const token: BootstrapToken = {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        iceCandidates: this.iceCandidatesBuffer.map(c => c.toJSON()),
        metadata: {
          timestamp: Date.now(),
          connectionId: this.connectionId
        }
      };

      return token;
    } catch (error) {
      this.setState(ConnectionState.FAILED);
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_GENERATION_FAILED,
        'Failed to create bootstrap token',
        error
      );
    }
  }

  /**
   * Wait for ICE gathering to complete
   */
  private waitForICEGathering(
    pc: RTCPeerConnection,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, timeout);

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);
    });
  }

  /**
   * Connect using bootstrap token as answerer
   * This is called when scanning QR or receiving remote token
   */
  public async connectWithBootstrapToken(token: BootstrapToken): Promise<void> {
    try {
      this.role = ConnectionRole.ANSWERER;
      this.setState(ConnectionState.CONNECTING);

      const pc = this.initializePeerConnection();

      // Set remote description from offer
      await pc.setRemoteDescription(new RTCSessionDescription(token.offer));

      // Add ICE candidates if provided
      if (token.iceCandidates && token.iceCandidates.length > 0) {
        for (const candidate of token.iceCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // In a real implementation, the answer would need to be sent back
      // via the same mechanism (QR scan response or remote service)
      // For this spec, we assume the answerer can communicate back

    } catch (error) {
      this.setState(ConnectionState.FAILED);
      throw new WebRTPayError(
        ErrorType.CONNECTION_FAILED,
        'Failed to connect with bootstrap token',
        error
      );
    }
  }

  /**
   * Complete connection by receiving answer (offerer side)
   */
  public async receiveAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.role !== ConnectionRole.OFFERER) {
      throw new WebRTPayError(
        ErrorType.CONNECTION_FAILED,
        'Only offerer can receive answer'
      );
    }

    if (!this.peerConnection) {
      throw new WebRTPayError(
        ErrorType.CONNECTION_FAILED,
        'No peer connection initialized'
      );
    }

    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
      this.setState(ConnectionState.CONNECTING);
    } catch (error) {
      this.setState(ConnectionState.FAILED);
      throw new WebRTPayError(
        ErrorType.CONNECTION_FAILED,
        'Failed to set remote answer',
        error
      );
    }
  }

  /**
   * Send JSON message through data channel
   */
  public async sendMessage(message: PaymentMessage): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new WebRTPayError(
        ErrorType.MESSAGE_SEND_FAILED,
        'Data channel is not open'
      );
    }

    try {
      const serialized = JSON.stringify(message);
      this.dataChannel.send(serialized);
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.MESSAGE_SEND_FAILED,
        'Failed to send message',
        error
      );
    }
  }

  /**
   * Check if connection is ready for messaging
   */
  public isReady(): boolean {
    return (
      this.state === ConnectionState.CONNECTED &&
      this.dataChannel !== null &&
      this.dataChannel.readyState === 'open'
    );
  }

  /**
   * Close connection and cleanup resources
   */
  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.setState(ConnectionState.CLOSED);
    this.eventListeners.clear();
    this.iceCandidatesBuffer = [];
  }

  /**
   * Get connection statistics
   */
  public async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) {
      return null;
    }
    return await this.peerConnection.getStats();
  }
}
