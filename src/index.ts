/**
 * WebRTPay - Mobile-to-Mobile WebRTC Connection System
 * Main entry point
 */

// Core exports
export { WebRTCConnection, DEFAULT_WEBRTC_CONFIG } from './core/WebRTCConnection';
export { ConnectionManager, createConnectionManager } from './core/ConnectionManager';
export type { ConnectionManagerConfig, ConnectionOptions } from './core/ConnectionManager';

// Types exports
export {
  ConnectionState,
  DataChannelState,
  ConnectionEvent,
  ConnectionRole,
  ErrorType,
  WebRTPayError
} from './core/types';

export type {
  BootstrapToken,
  IceServerConfig,
  WebRTCConfig,
  ConnectionEventMap,
  EventListener,
  PaymentMessage,
  RemoteBootstrapConfig
} from './core/types';

// Bootstrap exports
export { QRBootstrap } from './bootstrap/QRBootstrap';
export type { QRCodeOptions } from './bootstrap/QRBootstrap';

export { RemoteBootstrap, createRemoteBootstrap } from './bootstrap/RemoteBootstrap';
export type { PublishResponse, LookupResponse } from './bootstrap/RemoteBootstrap';

// Protocol exports
export {
  MessageProtocol,
  createMessageProtocol,
  PaymentMessageTypes,
  registerCommonSchemas
} from './protocol/MessageProtocol';
export type { MessageHandler, MessageSchema } from './protocol/MessageProtocol';

// Utilities
export * from './utils/helpers';

// Version
export const VERSION = '1.0.0';
