/**
 * QR-based local bootstrapping system
 * Handles QR code generation and scanning for peer discovery
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
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
 */
const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  errorCorrectionLevel: 'M',
  width: 300,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
};

export class QRBootstrap {
  /**
   * Compress bootstrap token for QR code
   * Removes unnecessary whitespace and optimizes payload size
   */
  private static compressToken(token: BootstrapToken): string {
    // Create minimal JSON representation
    const compressed = {
      o: token.offer,
      i: token.iceCandidates || [],
      m: token.metadata
    };
    return JSON.stringify(compressed);
  }

  /**
   * Decompress bootstrap token from QR code
   */
  private static decompressToken(compressed: string): BootstrapToken {
    try {
      const parsed = JSON.parse(compressed);

      // Handle both compressed and uncompressed formats
      if (parsed.o && parsed.i !== undefined && parsed.m) {
        return {
          offer: parsed.o,
          iceCandidates: parsed.i,
          metadata: parsed.m
        };
      }

      // Fallback to uncompressed format
      if (parsed.offer) {
        return parsed as BootstrapToken;
      }

      throw new Error('Invalid token format');
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to parse bootstrap token from QR code',
        error
      );
    }
  }

  /**
   * Generate QR code as data URL from bootstrap token
   * Returns a base64-encoded PNG image
   */
  public static async generateQRCode(
    token: BootstrapToken,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const compressed = this.compressToken(token);
      const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

      // Check payload size and warn if too large
      const sizeKb = new Blob([compressed]).size / 1024;
      if (sizeKb > 2) {
        console.warn(
          `QR code payload is ${sizeKb.toFixed(2)}KB. ` +
          'Consider reducing ICE candidates for better scanability.'
        );
      }

      const dataUrl = await QRCode.toDataURL(compressed, mergedOptions);
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
   * Generate QR code as SVG string
   * Useful for vector graphics in web applications
   */
  public static async generateQRCodeSVG(
    token: BootstrapToken,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const compressed = this.compressToken(token);
      const mergedOptions = { ...DEFAULT_QR_OPTIONS, ...options };

      const svg = await QRCode.toString(compressed, {
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
   * Scan QR code from image data
   * Extracts bootstrap token from QR code
   */
  public static scanQRCode(
    imageData: ImageData
  ): BootstrapToken | null {
    try {
      const code = jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
        {
          inversionAttempts: 'dontInvert'
        }
      );

      if (!code) {
        return null;
      }

      return this.decompressToken(code.data);
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to scan QR code',
        error
      );
    }
  }

  /**
   * Scan QR code from video stream
   * Continuously attempts to scan until a valid code is found or timeout
   */
  public static async scanQRCodeFromVideo(
    videoElement: HTMLVideoElement,
    timeoutMs: number = 30000
  ): Promise<BootstrapToken> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new WebRTPayError(
          ErrorType.BOOTSTRAP_PARSE_FAILED,
          'Failed to create canvas context'
        ));
        return;
      }

      const startTime = Date.now();
      let animationFrame: number;

      const scan = () => {
        if (Date.now() - startTime > timeoutMs) {
          cancelAnimationFrame(animationFrame);
          reject(new WebRTPayError(
            ErrorType.TIMEOUT,
            'QR code scan timeout'
          ));
          return;
        }

        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          try {
            const token = this.scanQRCode(imageData);
            if (token) {
              cancelAnimationFrame(animationFrame);
              resolve(token);
              return;
            }
          } catch (error) {
            // Continue scanning on parse errors
            console.debug('QR scan attempt failed, retrying...');
          }
        }

        animationFrame = requestAnimationFrame(scan);
      };

      scan();
    });
  }

  /**
   * Request camera access and start video stream
   * Returns video element ready for QR scanning
   */
  public static async setupCamera(
    facingMode: 'user' | 'environment' = 'environment'
  ): Promise<{ video: HTMLVideoElement; stream: MediaStream }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.play();

      return { video, stream };
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.BOOTSTRAP_PARSE_FAILED,
        'Failed to access camera',
        error
      );
    }
  }

  /**
   * Stop camera stream and cleanup
   */
  public static stopCamera(stream: MediaStream): void {
    stream.getTracks().forEach(track => track.stop());
  }

  /**
   * Estimate QR code payload size in bytes
   */
  public static estimatePayloadSize(token: BootstrapToken): number {
    const compressed = this.compressToken(token);
    return new Blob([compressed]).size;
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
