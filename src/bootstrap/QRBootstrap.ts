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
   * Generate QR code as data URL from a bootstrap token
   * Returns a base64-encoded PNG image
   */
  public static async generateQRCode(
    token: BootstrapToken,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      console.log('Generating QR code for token');
      const payload = JSON.stringify(token);
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
      const payload = JSON.stringify(token);
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
            console.log('QR Scanner: Token received');
            const token = JSON.parse(result.data) as BootstrapToken;
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
          maxScansPerSecond: 5
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
