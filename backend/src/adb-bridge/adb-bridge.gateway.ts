import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

interface BridgeClient {
  socket: Socket;
  connectedAt: Date;
}

interface PendingCommand {
  requestId: string;
  deviceId: string;
  command: string;
  resolve: (result: any) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

@WebSocketGateway({
  namespace: '/adb-bridge',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class AdbBridgeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdbBridgeGateway.name);
  private bridgeClient: BridgeClient | null = null;
  private pendingCommands = new Map<string, PendingCommand>();

  handleConnection(client: Socket) {
    const token = client.handshake.headers['x-bridge-token'] as string;
    const expectedToken = process.env.ADB_BRIDGE_TOKEN || 'bridge_secret_token';

    if (token !== expectedToken) {
      this.logger.warn(`Bridge connection rejected: invalid token`);
      client.disconnect(true);
      return;
    }

    this.bridgeClient = { socket: client, connectedAt: new Date() };
    this.logger.log(`✅ ADB Bridge connected`);

    // Listen for results from bridge
    client.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'adb_result') {
          this.handleAdbResult(msg);
        }
      } catch (e) {
        this.logger.error(`Invalid bridge message: ${e}`);
      }
    });
  }

  handleDisconnect() {
    this.bridgeClient = null;
    this.logger.log(`❌ ADB Bridge disconnected`);
  }

  isBridgeConnected(): boolean {
    return this.bridgeClient !== null;
  }

  /**
   * Send an ADB command to the bridge and wait for the result.
   */
  async executeAdbCommand(deviceId: string, command: string): Promise<{ success: boolean; output: string; error: string }> {
    if (!this.bridgeClient) {
      throw new Error('ADB Bridge not connected. Start the bridge on your admin computer.');
    }

    const requestId = uuidv4();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        reject(new Error('ADB command timed out (30s)'));
      }, 30000);

      this.pendingCommands.set(requestId, { requestId, deviceId, command, resolve, reject, timeout });

      this.bridgeClient!.socket.send(JSON.stringify({
        type: 'adb_command',
        requestId,
        deviceId,
        command,
      }));

      this.logger.log(`📤 Sent ADB command to bridge: ${command}`);
    });
  }

  private handleAdbResult(msg: { requestId: string; success: boolean; output: string; error: string }) {
    const pending = this.pendingCommands.get(msg.requestId);
    if (!pending) {
      this.logger.warn(`No pending command for requestId: ${msg.requestId}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(msg.requestId);

    if (msg.success) {
      this.logger.log(`✅ ADB command succeeded: ${msg.output}`);
    } else {
      this.logger.warn(`❌ ADB command failed: ${msg.error}`);
    }

    pending.resolve({ success: msg.success, output: msg.output, error: msg.error });
  }
}
