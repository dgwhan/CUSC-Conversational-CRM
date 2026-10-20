import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

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
