import { useState, useEffect, useRef } from 'react';
import {
  createConnectionManager,
  ConnectionManager,
  ConnectionState,
  ConnectionEvent,
  PaymentMessage,
  PaymentMessageTypes,
  QRBootstrap,
  isWebRTCSupported,
  getBrowserInfo
} from '../../src';

type Mode = 'create' | 'join';
type Method = 'qr' | 'remote';

function App() {
  const [mode, setMode] = useState<Mode>('create');
  const [method, setMethod] = useState<Method>('qr');
  const [manager, setManager] = useState<ConnectionManager | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.IDLE
  );
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [remoteUsername, setRemoteUsername] = useState<string>('');
  const [messages, setMessages] = useState<PaymentMessage[]>([]);
  const [messageInput, setMessageInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [stats, setStats] = useState({ sent: 0, received: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check WebRTC support on mount
  useEffect(() => {
    if (!isWebRTCSupported()) {
      setError('WebRTC is not supported in this browser');
    }

    const info = getBrowserInfo();
    console.log('Browser info:', info);
  }, []);

  // Initialize connection manager
  const initializeManager = () => {
    if (manager) {
      manager.close();
    }

    const newManager = createConnectionManager({
      connectionTimeout: 30000,
      autoRetry: true,
      maxRetries: 3,
      // Remote configuration (optional - would need actual server URLs)
      // remote: {
      //   broadcasterUrl: 'https://your-broadcaster.example.com',
      //   lookupUrl: 'https://your-lookup.example.com',
      //   tokenValidityMs: 300000
      // }
    });

    // Setup event listeners
    newManager.getConnection().on(ConnectionEvent.STATE_CHANGE, ({ state }) => {
      console.log('Connection state:', state);
      setConnectionState(state);

      if (state === ConnectionState.FAILED) {
        setError('Connection failed. Please try again.');
      }
    });

    newManager.onAnyMessage((message) => {
      console.log('Message received:', message);
      setMessages(prev => [...prev, message]);
      setStats(prev => ({ ...prev, received: prev.received + 1 }));
    });

    setManager(newManager);
    return newManager;
  };

  // Create QR connection
  const handleCreateQR = async () => {
    try {
      setError('');
      const mgr = initializeManager();

      const { qrCodeDataUrl } = await mgr.createQRConnection();
      setQrCodeUrl(qrCodeDataUrl);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Start scanning QR code
  const handleStartScan = async () => {
    try {
      setError('');
      setIsScanning(true);

      const { video, stream } = await QRBootstrap.setupCamera('environment');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mgr = initializeManager();
      await mgr.scanAndJoin(video, 30000);

      // Stop camera after successful scan
      stopCamera();
      setIsScanning(false);
    } catch (err) {
      setError((err as Error).message);
      stopCamera();
      setIsScanning(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      QRBootstrap.stopCamera(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Create remote connection
  const handleCreateRemote = async () => {
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    try {
      setError('');
      const mgr = initializeManager();

      await mgr.publishRemoteConnection(username);
      setError(''); // Success
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Join remote connection
  const handleJoinRemote = async () => {
    if (!remoteUsername || remoteUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    try {
      setError('');
      const mgr = initializeManager();

      await mgr.joinRemoteConnection(remoteUsername);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!manager || !messageInput.trim()) return;

    try {
      await manager.send(PaymentMessageTypes.PAYMENT_REQUEST, {
        text: messageInput,
        amount: 100,
        currency: 'USD',
        recipient: 'demo-recipient'
      });

      setMessageInput('');
      setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Send test payment
  const handleTestPayment = async () => {
    if (!manager) return;

    try {
      await manager.send(PaymentMessageTypes.PAYMENT_REQUEST, {
        amount: 50.00,
        currency: 'USD',
        recipient: 'test-user',
        description: 'Test payment'
      });

      setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Close connection
  const handleClose = () => {
    if (manager) {
      manager.close();
      setManager(null);
    }
    setConnectionState(ConnectionState.IDLE);
    setQrCodeUrl('');
    setMessages([]);
    setStats({ sent: 0, received: 0 });
    stopCamera();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (manager) {
        manager.close();
      }
      stopCamera();
    };
  }, [manager]);

  return (
    <div className="app">
      <h1>WebRTPay Demo</h1>

      {/* Status Card */}
      <div className="card">
        <h2>Connection Status</h2>
        <div className={`status ${connectionState}`}>
          {connectionState.toUpperCase()}
        </div>

        {error && <div className="error">{error}</div>}

        {connectionState === ConnectionState.IDLE && (
          <>
            <div className="tabs">
              <button
                className={`tab ${mode === 'create' ? 'active' : ''}`}
                onClick={() => setMode('create')}
              >
                Create
              </button>
              <button
                className={`tab ${mode === 'join' ? 'active' : ''}`}
                onClick={() => setMode('join')}
              >
                Join
              </button>
            </div>

            <div className="tabs">
              <button
                className={`tab ${method === 'qr' ? 'active' : ''}`}
                onClick={() => setMethod('qr')}
              >
                QR Code
              </button>
              <button
                className={`tab ${method === 'remote' ? 'active' : ''}`}
                onClick={() => setMethod('remote')}
              >
                Remote
              </button>
            </div>

            {/* Create Mode */}
            {mode === 'create' && (
              <>
                {method === 'qr' ? (
                  <>
                    <p className="info-text">
                      Generate a QR code for another device to scan
                    </p>
                    <button className="button" onClick={handleCreateQR}>
                      Generate QR Code
                    </button>
                  </>
                ) : (
                  <>
                    <p className="info-text">
                      Publish your connection to a remote server
                    </p>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <button className="button" onClick={handleCreateRemote}>
                      Publish Connection
                    </button>
                  </>
                )}
              </>
            )}

            {/* Join Mode */}
            {mode === 'join' && (
              <>
                {method === 'qr' ? (
                  <>
                    <p className="info-text">
                      Scan a QR code from another device
                    </p>
                    <button className="button" onClick={handleStartScan}>
                      Start Camera
                    </button>
                  </>
                ) : (
                  <>
                    <p className="info-text">
                      Lookup and connect to a remote user
                    </p>
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter username to connect"
                      value={remoteUsername}
                      onChange={(e) => setRemoteUsername(e.target.value)}
                    />
                    <button className="button" onClick={handleJoinRemote}>
                      Connect
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}

        {connectionState !== ConnectionState.IDLE && (
          <button className="button secondary" onClick={handleClose}>
            Close Connection
          </button>
        )}
      </div>

      {/* QR Code Display */}
      {qrCodeUrl && (
        <div className="card">
          <h2>QR Code</h2>
          <div className="qr-container">
            <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
            <p className="info-text">Scan this code with another device</p>
          </div>
        </div>
      )}

      {/* Video Scanner */}
      {isScanning && (
        <div className="card">
          <h2>Scanning...</h2>
          <div className="video-container">
            <video ref={videoRef} className="video" autoPlay playsInline />
          </div>
          <button className="button secondary" onClick={() => {
            stopCamera();
            setIsScanning(false);
          }}>
            Cancel
          </button>
        </div>
      )}

      {/* Messaging */}
      {connectionState === ConnectionState.CONNECTED && (
        <div className="card">
          <h2>Messages</h2>

          <div className="stats">
            <div className="stat">
              <div className="stat-value">{stats.sent}</div>
              <div className="stat-label">Sent</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.received}</div>
              <div className="stat-label">Received</div>
            </div>
          </div>

          <div className="messages">
            {messages.map((msg, idx) => (
              <div key={idx} className="message received">
                <div className="message-type">{msg.type}</div>
                <pre>{JSON.stringify(msg.payload, null, 2)}</pre>
                <div className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          <input
            type="text"
            className="input"
            placeholder="Enter message"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button className="button" onClick={handleSendMessage}>
            Send Message
          </button>
          <button className="button secondary" onClick={handleTestPayment}>
            Send Test Payment
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
