import { Module } from '@nestjs/common';
import {
  RabbitMQModule,
  MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'library',
          type: 'topic',
        },
      ],
      uri: `amqp://${process.env['RABBITMQ_USERNAME']}:${process.env['RABBITMQ_PASSWORD']}@${process.env['RABBITMQ_HOSTNAME']}:${process.env['RABBITMQ_AMQP_PORT']}/${process.env['RABBITMQ_VHOST']}`,
      connectionInitOptions: {},
    }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class RabbitmqPublistModule {}
