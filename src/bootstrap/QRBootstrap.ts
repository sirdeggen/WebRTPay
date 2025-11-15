/**
 * QR-based local bootstrapping system
 * Handles QR code generation and scanning for peer discovery
 *
 * Now simplified to encode/decode TXID strings for BSV Overlay Services signaling
 */

import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';
import { ErrorType, WebRTPayError } from '../core/types';

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
 */
const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  errorCorrectionLevel: 'M',
  width: 512,
  margin: 4,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
};

export class QRBootstrap {
  /**
   * Generate QR code as data URL from a TXID string
   * Returns a base64-encoded PNG image
   */
  public static async generateQRCode(
    txid: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      console.log('Generating QR code for TXID:', txid);
      const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

      const dataUrl = await QRCode.toDataURL(txid, mergedOptions);
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
   * Generate QR code as SVG string from a TXID
   * Useful for vector graphics in web applications
   */
  public static async generateQRCodeSVG(
    txid: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

      const svg = await QRCode.toString(txid, {
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
   * Scans for TXID strings
   */
  public static async createScanner(
    videoElement: HTMLVideoElement,
    onScan: (txid: string) => void,
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
            console.log('QR Scanner: TXID received:', result.data);
            onScan(result.data);
          } catch (error) {
            console.error('QR Scanner: Error processing scan:', error);
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
   * Continuously attempts to scan until a valid TXID is found or timeout
   */
  public static async scanQRCodeFromVideo(
    videoElement: HTMLVideoElement,
    timeoutMs: number = 30000
  ): Promise<string> {
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
        (txid) => {
          clearTimeout(timeoutId);
          cleanup();
          resolve(txid);
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
   * Estimate QR code payload size in bytes for a TXID string
   */
  public static estimatePayloadSize(txid: string): number {
    return new Blob([txid]).size;
  }

  /**
   * Validate TXID format (basic check for hex string)
   */
  public static validateTxid(txid: string): boolean {
    // Basic validation: check if it's a valid hex string of reasonable length
    return /^[a-fA-F0-9]{64}$/.test(txid);
  }
}
