import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // K8s 就绪/存活探针，在全局前缀和守卫之前注册以确保无需认证即可访问
  app.getHttpAdapter().get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.setGlobalPrefix('api');

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
