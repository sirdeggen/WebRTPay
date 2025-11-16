/**
 * QR-based local bootstrapping system
 * Handles QR code generation and scanning for peer discovery
 *
 * Uses trickle ICE with single QR code containing offer + initial ICE candidates
 * Answerer sends response through data channel once connected
 */

import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';
import { BootstrapToken, ErrorType, WebRTPayError } from '../core/types';

/**
 * QR code generation options
 */
export interface QRCodeOptions {
  /** Error correction level */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** QR code width in pixels */
  width?: number;
  /** QR code margin */
  margin?: number;
  /** Color options */
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Default QR code options optimized for mobile scanning
 * Using 'L' for lowest error correction = larger cells = easier scanning
 */
const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  errorCorrectionLevel: 'L',
  width: 512,
  margin: 4,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
};

export class QRBootstrap {
  /**
   * Serialize token to binary format and encode as base64
   * Binary format (no labels, fixed order):
   * - Version byte (1 byte): 0x01
   * - Flags byte (1 byte): bit 0 = trickleIce
   * - Timestamp (8 bytes): uint64 big-endian
   * - Connection ID length (1 byte) + Connection ID (variable UTF-8)
   * - SDP length (2 bytes) + SDP string (variable UTF-8)
   * - ICE candidates count (1 byte)
   * - For each ICE candidate:
   *   - Candidate string length (2 bytes) + candidate (variable UTF-8)
   *   - sdpMid length (1 byte) + sdpMid (variable UTF-8)
   *   - sdpMLineIndex (2 bytes): uint16
   */
  private static compressToken(token: BootstrapToken): string {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Version byte
    parts.push(new Uint8Array([0x01]));

    // Flags byte
    const flags = token.metadata?.trickleIce ? 0x01 : 0x00;
    parts.push(new Uint8Array([flags]));

    // Timestamp (8 bytes, uint64 big-endian)
    const timestamp = token.metadata?.timestamp || Date.now();
    const timestampBuf = new Uint8Array(8);
    const view = new DataView(timestampBuf.buffer);
    // JavaScript doesn't have native uint64, so we split it
    view.setUint32(0, Math.floor(timestamp / 0x100000000), false);
    view.setUint32(4, timestamp >>> 0, false);
    parts.push(timestampBuf);

    // Connection ID
    const connIdBytes = encoder.encode(token.metadata?.connectionId || '');
    parts.push(new Uint8Array([connIdBytes.length]));
    parts.push(connIdBytes);

    // SDP
    const sdpBytes = encoder.encode(token.offer.sdp || '');
    const sdpLenBuf = new Uint8Array(2);
    new DataView(sdpLenBuf.buffer).setUint16(0, sdpBytes.length, false);
    parts.push(sdpLenBuf);
    parts.push(sdpBytes);

    // ICE candidates count
    const candidates = token.iceCandidates || [];
    parts.push(new Uint8Array([candidates.length]));

    // Each ICE candidate
    for (const candidate of candidates) {
      // Candidate string
      const candBytes = encoder.encode(candidate.candidate || '');
      const candLenBuf = new Uint8Array(2);
      new DataView(candLenBuf.buffer).setUint16(0, candBytes.length, false);
      parts.push(candLenBuf);
      parts.push(candBytes);

      // sdpMid
      const midBytes = encoder.encode(candidate.sdpMid || '');
      parts.push(new Uint8Array([midBytes.length]));
      parts.push(midBytes);

      // sdpMLineIndex
      const mLineIdxBuf = new Uint8Array(2);
      new DataView(mLineIdxBuf.buffer).setUint16(0, candidate.sdpMLineIndex || 0, false);
      parts.push(mLineIdxBuf);
    }

    // Concatenate all parts
    const totalLength = parts.reduce((sum, arr) => sum + arr.length, 0);
    const binary = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      binary.set(part, offset);
      offset += part.length;
    }

    // Convert to base64
    return btoa(String.fromCharCode(...binary));
  }

  /**
   * Deserialize token from base64-encoded binary format
   */
  private static decompressToken(compressed: string): BootstrapToken {
    try {
      // Try base64 decode first (binary format)
      let binary: Uint8Array;
      try {
        const binaryStr = atob(compressed);
        binary = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          binary[i] = binaryStr.charCodeAt(i);
        }
      } catch {
        // Fallback to JSON format for backwards compatibility
        const parsed = JSON.parse(compressed);
        if (parsed.offer) {
          return parsed as BootstrapToken;
        }
        throw new Error('Invalid format');
      }

      const decoder = new TextDecoder();
      const view = new DataView(binary.buffer);
      let offset = 0;

      // Version byte
      const version = binary[offset++];
      if (version !== 0x01) {
        throw new Error('Unsupported version');
      }

      // Flags byte
      const flags = binary[offset++];
      const trickleIce = !!(flags & 0x01);

      // Timestamp (8 bytes)
      const timestampHigh = view.getUint32(offset, false);
      const timestampLow = view.getUint32(offset + 4, false);
      const timestamp = timestampHigh * 0x100000000 + timestampLow;
      offset += 8;

      // Connection ID
      const connIdLen = binary[offset++];
      const connectionId = decoder.decode(binary.slice(offset, offset + connIdLen));
      offset += connIdLen;

      // SDP
      const sdpLen = view.getUint16(offset, false);
      offset += 2;
      const sdp = decoder.decode(binary.slice(offset, offset + sdpLen));
      offset += sdpLen;

      // ICE candidates count
      const candidatesCount = binary[offset++];
      const iceCandidates: RTCIceCandidateInit[] = [];

      for (let i = 0; i < candidatesCount; i++) {
        // Candidate string
        const candLen = view.getUint16(offset, false);
        offset += 2;
        const candidate = decoder.decode(binary.slice(offset, offset + candLen));
        offset += candLen;

        // sdpMid
        const midLen = binary[offset++];
        const sdpMid = decoder.decode(binary.slice(offset, offset + midLen));
        offset += midLen;

        // sdpMLineIndex
        const sdpMLineIndex = view.getUint16(offset, false);
        offset += 2;

        iceCandidates.push({
          candidate,
          sdpMid,
          sdpMLineIndex
        });
      }

      return {
        offer: {
          type: 'offer',
          sdp
        },
        iceCandidates,
        metadata: {
          timestamp,
          connectionId,
          trickleIce
        }
      };
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to parse QR code data',
        error
      );
    }
  }

  /**
   * Generate QR code as data URL from a bootstrap token
   * Returns a base64-encoded PNG image
   */
  public static async generateQRCode(
    token: BootstrapToken,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      console.log('Generating QR code for token');
      const payload = this.compressToken(token);
      const sizeKb = new Blob([payload]).size / 1024;
      console.log(`QR code payload size: ${sizeKb.toFixed(2)}KB`);

      const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };
      const dataUrl = await QRCode.toDataURL(payload, mergedOptions);
      return dataUrl;
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_GENERATION_FAILED,
        'Failed to generate QR code',
        error
      );
    }
  }

  /**
   * Generate QR code as SVG string from a bootstrap token
   * Useful for vector graphics in web applications
   */
  public static async generateQRCodeSVG(
    token: BootstrapToken,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const payload = this.compressToken(token);
      const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

      const svg = await QRCode.toString(payload, {
        ...mergedOptions,
        type: 'svg'
      });
      return svg;
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_GENERATION_FAILED,
        'Failed to generate QR code SVG',
        error
      );
    }
  }

  /**
   * Create and start a QR scanner on a video element
   * Returns scanner instance that must be stopped and destroyed when done
   * Scans for BootstrapToken
   */
  public static async createScanner(
    videoElement: HTMLVideoElement,
    onScan: (token: BootstrapToken) => void,
    onError?: (error: Error) => void
  ): Promise<QrScanner> {
    try {
      // Check if camera is available
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        throw new WebRTPayError(
          ErrorType.BOOTSTRAP_PARSE_FAILED,
          'No camera available on this device'
        );
      }

      const scanner = new QrScanner(
        videoElement,
        (result) => {
          try {
            console.log('QR Scanner: Raw data received:', result.data.substring(0, 100));
            console.log('QR Scanner: Data length:', result.data.length);
            const token = this.decompressToken(result.data);
            console.log('QR Scanner: Token parsed successfully');
            onScan(token);
          } catch (error) {
            console.error('QR Scanner: Error parsing token:', error);
            if (onError) {
              onError(error as Error);
            }
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 10,
          returnDetailedScanResult: true,
          calculateScanRegion: (video) => {
            // Use entire video frame for better QR code detection
            const size = Math.min(video.videoWidth, video.videoHeight);
            return {
              x: (video.videoWidth - size) / 2,
              y: (video.videoHeight - size) / 2,
              width: size,
              height: size,
              downScaledWidth: size,
              downScaledHeight: size
            };
          }
        }
      );

      await scanner.start();
      return scanner;
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to start QR scanner',
        error
      );
    }
  }

  /**
   * Scan QR code from video stream
   * Continuously attempts to scan until a valid token is found or timeout
   */
  public static async scanQRCodeFromVideo(
    videoElement: HTMLVideoElement,
    timeoutMs: number = 30000
  ): Promise<BootstrapToken> {
    return new Promise((resolve, reject) => {
      let scanner: QrScanner | null = null;

      const cleanup = () => {
        if (scanner) {
          scanner.stop();
          scanner.destroy();
          scanner = null;
        }
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new WebRTPayError(
          ErrorType.TIMEOUT,
          'QR code scan timeout'
        ));
      }, timeoutMs);

      this.createScanner(
        videoElement,
        (token) => {
          clearTimeout(timeoutId);
          cleanup();
          resolve(token);
        },
        (error) => {
          // Continue scanning on parse errors
          console.debug('QR scan attempt failed, retrying...', error);
        }
      ).then(s => {
        scanner = s;
      }).catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Stop and destroy a QR scanner
   */
  public static stopScanner(scanner: QrScanner): void {
    scanner.stop();
    scanner.destroy();
  }

  /**
   * Check if camera is available on this device
   */
  public static async hasCameraSupport(): Promise<boolean> {
    try {
      return await QrScanner.hasCamera();
    } catch {
      return false;
    }
  }

  /**
   * List available cameras
   */
  public static async listCameras(): Promise<QrScanner.Camera[]> {
    try {
      return await QrScanner.listCameras(true);
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to list cameras',
        error
      );
    }
  }

  /**
   * Estimate QR code payload size in bytes for a bootstrap token
   */
  public static estimatePayloadSize(token: BootstrapToken): number {
    const payload = JSON.stringify(token);
    return new Blob([payload]).size;
  }

  /**
   * Validate bootstrap token structure
   */
  public static validateToken(token: BootstrapToken): boolean {
    return !!(
      token &&
      token.offer &&
      token.offer.type &&
      token.offer.sdp &&
      token.metadata &&
      token.metadata.timestamp &&
      token.metadata.connectionId
    );
  }

  /**
   * Check if token is expired
   */
  public static isTokenExpired(
    token: BootstrapToken,
    maxAgeMs: number = 300000 // 5 minutes default
  ): boolean {
    if (!token.metadata || !token.metadata.timestamp) {
      return true;
    }
    return Date.now() - token.metadata.timestamp > maxAgeMs;
  }
}
