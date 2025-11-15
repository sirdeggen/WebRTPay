/**
 * JSON message protocol handler
 * Manages message serialization, validation, and routing
 */

import { PaymentMessage, ErrorType, WebRTPayError } from '../core/types';

/**
 * Message handler callback
 */
export type MessageHandler = (message: PaymentMessage) => void | Promise<void>;

/**
 * Message validation schema
 */
export interface MessageSchema {
  type: string;
  requiredFields?: string[];
  validate?: (payload: unknown) => boolean;
}

/**
 * Message queue entry
 */
interface QueuedMessage {
  message: PaymentMessage;
  timestamp: number;
  retries: number;
}

export class MessageProtocol {
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private schemas: Map<string, MessageSchema> = new Map();
  private messageQueue: QueuedMessage[] = [];
  private messageHistory: PaymentMessage[] = [];
  private maxHistorySize: number = 100;
  private maxRetries: number = 3;

  /**
   * Register message type schema for validation
   */
  public registerSchema(schema: MessageSchema): void {
    this.schemas.set(schema.type, schema);
  }

  /**
   * Register message handler for specific type
   */
  public on(messageType: string, handler: MessageHandler): void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType)!.add(handler);
  }

  /**
   * Unregister message handler
   */
  public off(messageType: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(messageType);
      }
    }
  }

  /**
   * Register wildcard handler for all message types
   */
  public onAny(handler: MessageHandler): void {
    this.on('*', handler);
  }

  /**
   * Create a new payment message
   */
  public createMessage(type: string, payload: unknown): PaymentMessage {
    const message: PaymentMessage = {
      type,
      payload,
      timestamp: Date.now(),
      messageId: this.generateMessageId()
    };

    // Validate against schema if registered
    this.validateMessage(message);

    return message;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate message against registered schema
   */
  public validateMessage(message: PaymentMessage): void {
    const schema = this.schemas.get(message.type);
    if (!schema) {
      return; // No schema registered, skip validation
    }

    // Check required fields in payload
    if (schema.requiredFields && typeof message.payload === 'object' && message.payload !== null) {
      const payload = message.payload as Record<string, unknown>;
      for (const field of schema.requiredFields) {
        if (!(field in payload)) {
          throw new WebRTPayError(
            ErrorType.MESSAGE_SEND_FAILED,
            `Missing required field: ${field} in message type: ${message.type}`
          );
        }
      }
    }

    // Run custom validation if provided
    if (schema.validate && !schema.validate(message.payload)) {
      throw new WebRTPayError(
        ErrorType.MESSAGE_SEND_FAILED,
        `Validation failed for message type: ${message.type}`
      );
    }
  }

  /**
   * Process incoming message
   * Routes to registered handlers and adds to history
   */
  public async processMessage(message: PaymentMessage): Promise<void> {
    try {
      // Validate message
      this.validateMessage(message);

      // Add to history
      this.addToHistory(message);

      // Get specific handlers for this message type
      const specificHandlers = this.handlers.get(message.type);
      const wildcardHandlers = this.handlers.get('*');

      const allHandlers = [
        ...(specificHandlers || []),
        ...(wildcardHandlers || [])
      ];

      if (allHandlers.length === 0) {
        console.warn(`No handlers registered for message type: ${message.type}`);
        return;
      }

      // Execute all handlers
      await Promise.allSettled(
        allHandlers.map(handler => handler(message))
      );
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.MESSAGE_SEND_FAILED,
        'Failed to process message',
        error
      );
    }
  }

  /**
   * Add message to history
   */
  private addToHistory(message: PaymentMessage): void {
    this.messageHistory.push(message);

    // Trim history if it exceeds max size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get message history
   */
  public getHistory(messageType?: string): PaymentMessage[] {
    if (messageType) {
      return this.messageHistory.filter(msg => msg.type === messageType);
    }
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  public clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Queue message for retry on failure
   */
  public queueMessage(message: PaymentMessage): void {
    this.messageQueue.push({
      message,
      timestamp: Date.now(),
      retries: 0
    });
  }

  /**
   * Get queued messages
   */
  public getQueue(): PaymentMessage[] {
    return this.messageQueue.map(q => q.message);
  }

  /**
   * Clear message queue
   */
  public clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Retry failed messages from queue
   */
  public async retryQueuedMessages(
    sendFn: (message: PaymentMessage) => Promise<void>
  ): Promise<void> {
    const toRetry = [...this.messageQueue];
    this.messageQueue = [];

    for (const queued of toRetry) {
      if (queued.retries >= this.maxRetries) {
        console.error(
          `Message ${queued.message.messageId} exceeded max retries`
        );
        continue;
      }

      try {
        await sendFn(queued.message);
      } catch (error) {
        console.error('Retry failed:', error);
        this.messageQueue.push({
          ...queued,
          retries: queued.retries + 1
        });
      }
    }
  }

  /**
   * Serialize message to JSON string
   */
  public serialize(message: PaymentMessage): string {
    try {
      return JSON.stringify(message);
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.MESSAGE_SEND_FAILED,
        'Failed to serialize message',
        error
      );
    }
  }

  /**
   * Deserialize message from JSON string
   */
  public deserialize(data: string): PaymentMessage {
    try {
      const message = JSON.parse(data) as PaymentMessage;

      // Validate basic structure
      if (!message.type || !message.messageId || !message.timestamp) {
        throw new Error('Invalid message structure');
      }

      return message;
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to deserialize message',
        error
      );
    }
  }

  /**
   * Check if message is duplicate based on ID
   */
  public isDuplicate(messageId: string): boolean {
    return this.messageHistory.some(msg => msg.messageId === messageId);
  }

  /**
   * Get message by ID from history
   */
  public findMessage(messageId: string): PaymentMessage | undefined {
    return this.messageHistory.find(msg => msg.messageId === messageId);
  }

  /**
   * Set max history size
   */
  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    if (this.messageHistory.length > size) {
      this.messageHistory = this.messageHistory.slice(-size);
    }
  }

  /**
   * Set max retry attempts
   */
  public setMaxRetries(retries: number): void {
    this.maxRetries = retries;
  }

  /**
   * Get statistics
   */
  public getStats(): {
    totalMessages: number;
    queuedMessages: number;
    registeredHandlers: number;
    registeredSchemas: number;
  } {
    return {
      totalMessages: this.messageHistory.length,
      queuedMessages: this.messageQueue.length,
      registeredHandlers: Array.from(this.handlers.values()).reduce(
        (sum, handlers) => sum + handlers.size,
        0
      ),
      registeredSchemas: this.schemas.size
    };
  }
}

/**
 * Create a new MessageProtocol instance
 */
export function createMessageProtocol(): MessageProtocol {
  return new MessageProtocol();
}

/**
 * Common payment message types
 */
export const PaymentMessageTypes = {
  PAYMENT_REQUEST: 'payment_request',
  PAYMENT_RESPONSE: 'payment_response',
  PAYMENT_ACKNOWLEDGMENT: 'payment_acknowledgment',
  ERROR: 'error',
  HANDSHAKE: 'handshake',
  PING: 'ping',
  PONG: 'pong'
} as const;

/**
 * Register common payment schemas
 */
export function registerCommonSchemas(protocol: MessageProtocol): void {
  protocol.registerSchema({
    type: PaymentMessageTypes.PAYMENT_REQUEST,
    requiredFields: ['amount', 'currency', 'recipient']
  });

  protocol.registerSchema({
    type: PaymentMessageTypes.PAYMENT_RESPONSE,
    requiredFields: ['status', 'transactionId']
  });

  protocol.registerSchema({
    type: PaymentMessageTypes.PAYMENT_ACKNOWLEDGMENT,
    requiredFields: ['transactionId', 'confirmed']
  });

  protocol.registerSchema({
    type: PaymentMessageTypes.ERROR,
    requiredFields: ['code', 'message']
  });

  protocol.registerSchema({
    type: PaymentMessageTypes.HANDSHAKE,
    requiredFields: ['version', 'capabilities']
  });
}
