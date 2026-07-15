import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/admin',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class AdminWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminWebSocketGateway.name);
  private readonly clients = new Set<Socket>();

  afterInit(server: Server) {
    this.logger.log('Admin WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.clients.add(client);
    this.logger.log(`Admin client connected (${this.clients.size} total)`);
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client);
    this.logger.log(`Admin client disconnected (${this.clients.size} total)`);
  }

  /**
   * Broadcast device status change to all connected admin clients.
   */
  broadcastDeviceUpdate(device: any) {
    this.server.emit('device:update', {
      _id: device._id,
      name: device.name,
      status: device.status,
      securityMode: device.securityMode,
      standaloneDeviceId: device.standaloneDeviceId,
      lastSeen: device.lastSeen,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Broadcast device list refresh to all connected admin clients.
   */
  broadcastDeviceListUpdate() {
    this.server.emit('devices:refresh');
  }
}
