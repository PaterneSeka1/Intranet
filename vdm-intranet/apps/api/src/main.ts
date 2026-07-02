import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser = require('cookie-parser')
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(helmet())
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  )
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  })

  if (process.env.NODE_ENV !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('VDM Intranet API')
      .setDescription('API du portail intranet — Veilleur des Médias')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build()
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger))
    console.log(`[Swagger] http://localhost:${process.env.API_PORT ?? 3001}/api/docs`)
  }

  const port = process.env.API_PORT ?? 3001
  await app.listen(port)
  console.log(`[API] http://localhost:${port}/api`)
}
bootstrap()
