import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway(3004, { namespace: 'medAgent' })
export class AgentGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('message')
  handleMessage(@MessageBody() message: string) {
    this.server.emit(message);
  }
}
