import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { StandaloneMdmService } from './standalone-mdm.service';

interface DpcClient {
  socket: Socket;
  deviceId: string;
  connectedAt: Date;
}

@WebSocketGateway({
  namespace: '/dpc',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class DpcWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DpcWebSocketGateway.name);
  private readonly clients = new Map<string, DpcClient>();

  constructor(private readonly service: StandaloneMdmService) {}

  afterInit(server: Server) {
    this.logger.log('DPC WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    // Support both Socket.IO auth option and HTTP headers
    const auth = (client.handshake.auth ?? {}) as Record<string, string>;
    const headers = client.handshake.headers;
    const deviceId = auth['X-DPC-Device-Id'] || headers['x-dpc-device-id'] as string;
    const apiKey = auth['X-DPC-Api-Key'] || headers['x-dpc-api-key'] as string;

    if (!deviceId || !apiKey) {
      this.logger.warn(`Connection rejected: missing auth headers`);
      client.disconnect(true);
      return;
    }

    // Validate credentials
    const device = await this.service.validateDevice(deviceId, apiKey);
    if (!device) {
      this.logger.warn(`Connection rejected: invalid credentials for ${deviceId}`);
      client.disconnect(true);
      return;
    }

    // Store client
    this.clients.set(deviceId, {
      socket: client,
      deviceId,
      connectedAt: new Date(),
    });

    this.logger.log(`✅ Device connected: ${deviceId} (${this.clients.size} total)`);

    // Notify device of successful connection
    client.emit('connected', {
      deviceId,
      message: 'WebSocket connection established',
      serverTime: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    const auth = (client.handshake.auth ?? {}) as Record<string, string>;
    const deviceId = auth['X-DPC-Device-Id'] || client.handshake.headers['x-dpc-device-id'] as string;
    
    if (this.clients.has(deviceId)) {
      this.clients.delete(deviceId);
      this.logger.log(`❌ Device disconnected: ${deviceId} (${this.clients.size} total)`);
    }
  }

  /**
   * Send command to a specific device via WebSocket.
   * Returns true if the device is connected and received the command.
   */
  sendCommand(deviceId: string, command: any): boolean {
    const client = this.clients.get(deviceId);
    if (!client) {
      this.logger.debug(`Device ${deviceId} not connected via WebSocket`);
      return false;
    }

    client.socket.emit('command', command);
    this.logger.log(`📤 Sent command to ${deviceId}: ${command.commandType}`);
    return true;
  }

  /**
   * Check if a device is currently connected via WebSocket.
   */
  isDeviceConnected(deviceId: string): boolean {
    return this.clients.has(deviceId);
  }

  /**
   * Get count of connected devices.
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected device IDs.
   */
  getConnectedDeviceIds(): string[] {
    return Array.from(this.clients.keys());
  }
}
