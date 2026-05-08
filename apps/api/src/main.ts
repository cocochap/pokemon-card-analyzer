import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import helmet from 'helmet'
import compression from 'compression'
import { AppModule } from './app.module'
import { WinstonModule } from 'nest-winston'
import * as winston from 'winston'

async function bootstrap() {
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
          }),
        ),
      }),
    ],
  })

  const app = await NestFactory.create(AppModule, { logger })
  const config = app.get(ConfigService)

  // Security
  app.use(helmet())
  app.use(compression())

  // Global prefix
  app.setGlobalPrefix('api')

  // Versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  // CORS
  app.enableCors({
    origin: [
      config.get('FRONTEND_URL', 'http://localhost:3000'),
      /\.pokemarket\.io$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Swagger API docs
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PokeMarket API')
      .setDescription('Pokémon TCG Market Intelligence API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    })
  }

  const port = config.get<number>('PORT', 3001)
  await app.listen(port)
  logger.log(`🚀 API running at http://localhost:${port}`)
  logger.log(`📖 Swagger docs at http://localhost:${port}/api/docs`)
}

bootstrap()
