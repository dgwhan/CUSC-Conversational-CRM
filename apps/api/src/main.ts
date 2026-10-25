import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './modules/realtime/realtime.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 20 * 1024 * 1024 }),
    {
      rawBody: true,
      logger: ['error', 'warn', 'log'],
    },
  );

  // Cho phép CORS cho frontend kết nối
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Hỗ trợ parse định dạng text/csv và text/plain
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addContentTypeParser(
    ['text/plain', 'text/csv'],
    { parseAs: 'string' },
    (_req: unknown, body: string, done: (err: Error | null, result?: unknown) => void) => {
      done(null, body);
    },
  );

  // Khởi tạo và gắn kết nối WebSocket Server trên Fastify HTTP Server
  const realtimeService = app.get(RealtimeService);
  realtimeService.attachHttpServer(fastify.server);

  // Allow API endpoints will start with /api/ 
  app.setGlobalPrefix('api');

  // Allow NestJS to clean up resource during shutdown
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
}
await bootstrap();
