/**
 * Remote bootstrapping system
 * Handles Topic Broadcaster and Lookup Resolver interactions
 */

import {
  BootstrapToken,
  RemoteBootstrapConfig,
  ErrorType,
  WebRTPayError
} from '../core/types';

/**
 * Token publication response
 */
export interface PublishResponse {
  success: boolean;
  tokenId: string;
  expiresAt: number;
}

/**
 * Token lookup response
 */
export interface LookupResponse {
  found: boolean;
  token?: BootstrapToken;
  username?: string;
  publishedAt?: number;
}

/**
 * Default configuration
 */
const DEFAULT_TOKEN_VALIDITY_MS = 300000; // 5 minutes

export class RemoteBootstrap {
  private config: Required<RemoteBootstrapConfig>;

  constructor(config: RemoteBootstrapConfig) {
    this.config = {
      ...config,
      tokenValidityMs: config.tokenValidityMs || DEFAULT_TOKEN_VALIDITY_MS
    };
  }

  /**
   * Publish bootstrap token to Topic Broadcaster
   * Associates token with username for discovery
   */
  public async publishToken(
    username: string,
    token: BootstrapToken
  ): Promise<PublishResponse> {
    try {
      // Validate username
      if (!username || username.length < 3) {
        throw new WebRTPayError(
          ErrorType.REMOTE_SERVICE_ERROR,
          'Username must be at least 3 characters'
        );
      }

      // Add expiration to metadata
      const tokenWithExpiry: BootstrapToken = {
        ...token,
        metadata: {
          ...token.metadata,
          username,
          expiresAt: Date.now() + this.config.tokenValidityMs
        }
      };

      const response = await fetch(this.config.broadcasterUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          token: tokenWithExpiry,
          ttl: this.config.tokenValidityMs
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        tokenId: data.tokenId || data.id || username,
        expiresAt: Date.now() + this.config.tokenValidityMs
      };
    } catch (error) {
      throw new WebRTPayError(
        ErrorType.REMOTE_SERVICE_ERROR,
        'Failed to publish token to broadcaster',
        error
      );
    }
  }

  /**
   * Lookup bootstrap token from Lookup Resolver
   * Retrieves token associated with username
   */
  public async lookupToken(username: string): Promise<LookupResponse> {
    try {
      // Validate username
      if (!username || username.length < 3) {
        throw new WebRTPayError(
          ErrorType.REMOTE_SERVICE_ERROR,
          'Username must be at least 3 characters'
        );
      }

      const url = new URL(this.config.lookupUrl);
      url.searchParams.append('username', username);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.status === 404) {
        return {
          found: false
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.token) {
        return {
          found: false
        };
      }

      const token = data.token as BootstrapToken;

      // Validate token
      if (!this.validateToken(token)) {
        throw new WebRTPayError(
          ErrorType.BOOTSTRAP_PARSE_FAILED,
          'Invalid token format received from lookup service'
        );
      }

      // Check if token is expired
      if (token.metadata?.expiresAt && Date.now() > token.metadata.expiresAt) {
        return {
          found: false
        };
      }

      return {
        found: true,
        token,
        username: data.username || username,
        publishedAt: token.metadata?.timestamp
      };
    } catch (error) {
      if (error instanceof WebRTPayError) {
        throw error;
      }
      throw new WebRTPayError(
        ErrorType.REMOTE_SERVICE_ERROR,
        'Failed to lookup token from resolver',
        error
      );
    }
  }

  /**
   * Delete published token
   * Removes token from broadcaster (if supported)
   */
  public async deleteToken(username: string): Promise<boolean> {
    try {
      const url = new URL(this.config.broadcasterUrl);
      url.searchParams.append('username', username);

      const response = await fetch(url.toString(), {
        method: 'DELETE'
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to delete token:', error);
      return false;
    }
  }

  /**
   * Refresh token expiration
   * Extends TTL for existing token
   */
  public async refreshToken(username: string): Promise<boolean> {
    try {
      const response = await fetch(this.config.broadcasterUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          ttl: this.config.tokenValidityMs
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }

  /**
   * Validate bootstrap token structure
   */
  private validateToken(token: BootstrapToken): boolean {
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
   * Get service health status
   */
  public async checkHealth(): Promise<{
    broadcaster: boolean;
    lookup: boolean;
  }> {
    const results = {
      broadcaster: false,
      lookup: false
    };

    try {
      const broadcasterResponse = await fetch(
        `${this.config.broadcasterUrl}/health`,
        { method: 'GET' }
      );
      results.broadcaster = broadcasterResponse.ok;
    } catch {
      results.broadcaster = false;
    }

    try {
      const lookupResponse = await fetch(
        `${this.config.lookupUrl}/health`,
        { method: 'GET' }
      );
      results.lookup = lookupResponse.ok;
    } catch {
      results.lookup = false;
    }

    return results;
  }
}

/**
 * Create RemoteBootstrap instance with configuration
 */
export function createRemoteBootstrap(
  config: RemoteBootstrapConfig
): RemoteBootstrap {
  return new RemoteBootstrap(config);
}
