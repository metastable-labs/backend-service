import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import * as compression from 'compression';
import * as requestIp from 'request-ip';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { env } from './common/config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors();

  app.use(helmet());

  app.use(compression());

  app.use(requestIp.mw());

  const config = new DocumentBuilder()
    .setTitle('Supermigrate API')
    .setDescription('The Supermigrate API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.log('App error', { err, req, res });

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error, please try again later.',
      error: err.message,
    });

    next();
  });

  process
    .on('unhandledRejection', (reason, p) => {
      console.log('Unhandled Rejection at Promise', { reason, p });
    })
    .on('uncaughtException', (err) => {
      console.log('Uncaught Exception thrown', { err });
    });

  await app.listen(process.env.PORT ?? env.app.port);
}
bootstrap();
