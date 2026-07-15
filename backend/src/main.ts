import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Ensure upload directories exist on startup
  const uploadDirs = ['uploads/apks', 'uploads/dpc'];
  for (const dir of uploadDirs) {
    fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.BACKEND_PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Rental API running on http://localhost:${port}/api`);
}
bootstrap();

