/**
 * BSV Overlay Services signaling for WebRTC
 * Uses TopicBroadcaster (SHIP) and LookupResolver for peer discovery
 */

import {
  PushDrop,
  TopicBroadcaster,
  LookupResolver,
  Transaction,
  WalletInterface,
  LockingScript
} from '@bsv/sdk';

export interface OverlaySignalingConfig {
  /** Wallet interface for key management and signing */
  wallet: WalletInterface;
  /** Optional network preset (mainnet, testnet, local) - defaults to 'mainnet' */
  networkPreset?: 'mainnet' | 'testnet' | 'local';
}

export interface SignalingMessage {
  /** SDP string */
  sdp: string;
  /** SDP type: offer or answer */
  sdpType: 'offer' | 'answer';
  /** ICE candidates */
  iceCandidates: RTCIceCandidateInit[];
  /** Timestamp */
  timestamp: number;
}

const PROTOCOL_ID: [0 | 1 | 2, string] = [1, 'webrtp'];
const TOPIC_WEBRTP = 'tm_anytx';
const LOOKUP_SERVICE = 'ls_anytx';

export class OverlaySignaling {
  private readonly wallet: WalletInterface;
  private readonly networkPreset: 'mainnet' | 'testnet' | 'local';

  constructor(config: OverlaySignalingConfig) {
    this.wallet = config.wallet;
    this.networkPreset = config.networkPreset || 'mainnet';
  }

  /**
   * Broadcast WebRTC offer to overlay network
   * Uses PushDrop token and TopicBroadcaster (SHIP)
   * Returns the TXID to be encoded in the QR code
   */
  public async broadcastOffer(
    offer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidateInit[]
  ): Promise<string> {

    const message: SignalingMessage = {
      sdp: offer.sdp || '',
      sdpType: 'offer',
      iceCandidates,
      timestamp: Date.now()
    };

    try {
      const keyID = Date.now().toString();

      // Create PushDrop token with the signaling data
      const pushDrop = new PushDrop(this.wallet);
      const messageBytes = Buffer.from(JSON.stringify(message));
      const lockingScript = await pushDrop.lock(
        [Array.from(messageBytes)],
        PROTOCOL_ID,
        keyID,
        'anyone',
        true,  // forSelf
        true    // includeSignature
      );

      // Create transaction with the PushDrop output
      const tx = new Transaction();
      tx.addOutput({
        lockingScript,
        satoshis: 1
      });

      // Broadcast using TopicBroadcaster (SHIP)
      const broadcaster = new TopicBroadcaster(
        [TOPIC_WEBRTP],
        { networkPreset: this.networkPreset }
      );

      await broadcaster.broadcast(tx);

      // Return TXID for QR code encoding
      const txid = tx.id('hex');
      console.log('Offer broadcasted to overlay network with TXID:', txid);
      return txid;
    } catch (error) {
      console.error('Failed to broadcast offer:', error);
      throw new Error('Failed to broadcast offer to overlay network');
    }
  }

  /**
   * Broadcast WebRTC answer to overlay network
   */
  public async broadcastAnswer(
    offerTxid: string,
    answer: RTCSessionDescriptionInit,
    iceCandidates: RTCIceCandidateInit[]
  ): Promise<string> {

    const message: SignalingMessage = {
      sdp: answer.sdp || '',
      sdpType: 'answer',
      iceCandidates,
      timestamp: Date.now()
    };

    try {
      const keyID = Date.now().toString();

      // Create PushDrop token with the signaling data
      const pushDrop = new PushDrop(this.wallet);
      const messageBytes = Buffer.from(JSON.stringify(message));
      const offerTxidBytes = Buffer.from(offerTxid);

      const lockingScript = await pushDrop.lock(
        [
          Array.from(messageBytes),
          Array.from(offerTxidBytes) // Include offer TXID for lookup routing
        ],
        PROTOCOL_ID,
        keyID,
        'anyone',
        true,  // forSelf
        true    // includeSignature
      );

      // Create transaction with the PushDrop output
      const { tx: atomicBeef } = await this.wallet.createAction({
        description: 'Signalling For P2P Connection',
        outputs: [
          {
            lockingScript: lockingScript.toHex(),
            satoshis: 1,
            outputDescription: 'WebRTP signalling token'
          }
        ]
      });

      const tx = Transaction.fromAtomicBEEF(atomicBeef as number[]);

      // Broadcast using TopicBroadcaster (SHIP)
      const overlay = new TopicBroadcaster(
        [TOPIC_WEBRTP],
        { networkPreset: this.networkPreset }
      );

      await overlay.broadcast(tx);

      const answerTxid = tx.id('hex');
      console.log('Answer broadcasted to overlay network with TXID:', answerTxid);
      return answerTxid;
    } catch (error) {
      console.error('Failed to broadcast answer:', error);
      throw new Error('Failed to broadcast answer to overlay network');
    }
  }

  /**
   * Lookup offer from a peer using the transaction TXID from the QR code
   */
  public async lookupOffer(txid: string): Promise<SignalingMessage | null> {
    try {
      const resolver = new LookupResolver({
        networkPreset: this.networkPreset
      });

      const answer = await resolver.query({
        service: LOOKUP_SERVICE,
        query: {
          txid,
          sdpType: 'offer'
        }
      });

      if (answer.type !== 'output-list' || answer.outputs.length === 0) {
        return null;
      }

      // Get the offer output (first result)
      const output = answer.outputs[0];

      // Decode PushDrop token from the output script
      const lockingScript = LockingScript.fromBinary(output.beef);
      const decoded = PushDrop.decode(lockingScript);

      if (!decoded.fields || decoded.fields.length === 0) {
        return null;
      }

      const messageBytes = Buffer.from(decoded.fields[0]);
      const message: SignalingMessage = JSON.parse(messageBytes.toString('utf8'));

      return message;
    } catch (error) {
      console.error('Failed to lookup offer:', error);
      return null;
    }
  }

  /**
   * Lookup answer from a peer using the offer TXID
   */
  public async lookupAnswer(offerTxid: string): Promise<SignalingMessage | null> {
    try {
      const resolver = new LookupResolver({
        networkPreset: this.networkPreset
      });

      const answer = await resolver.query({
        service: LOOKUP_SERVICE,
        query: {
          sdpType: 'answer',
          offerTxid // Look for answers that reference this offer
        }
      });

      if (answer.type !== 'output-list' || answer.outputs.length === 0) {
        return null;
      }

      // Get the most recent answer (first result)
      const output = answer.outputs[0];

      // Decode PushDrop token from the output script
      const lockingScript = LockingScript.fromBinary(output.beef);
      const decoded = PushDrop.decode(lockingScript);

      if (!decoded.fields || decoded.fields.length === 0) {
        return null;
      }

      const messageBytes = Buffer.from(decoded.fields[0]);
      const message: SignalingMessage = JSON.parse(messageBytes.toString('utf8'));

      return message;
    } catch (error) {
      console.error('Failed to lookup answer:', error);
      return null;
    }
  }

  /**
   * Poll for answer with timeout
   */
  public async waitForAnswer(
    offerTxid: string,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 2000
  ): Promise<SignalingMessage | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const answer = await this.lookupAnswer(offerTxid);
      if (answer) {
        return answer;
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return null; // Timeout
  }
}
