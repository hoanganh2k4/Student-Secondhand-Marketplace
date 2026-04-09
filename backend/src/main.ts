import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')

  const config = new DocumentBuilder()
    .setTitle('Student Marketplace API')
    .setDescription(
      'REST API for the Student Secondhand Marketplace.\n\n' +
      '**How to authenticate:**\n' +
      '1. Call `POST /auth/login` with email + password\n' +
      '2. Copy the `accessToken` from the response\n' +
      '3. Click **Authorize** (🔒) → paste the token → **Authorize**',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .build()

  const document = SwaggerModule.createDocument(app, config)

  // Apply Bearer auth globally to all operations that have security requirements
  Object.values(document.paths).forEach((path: any) => {
    Object.values(path).forEach((op: any) => {
      if (op.security) {
        op.security = [{ 'access-token': [] }]
      }
    })
  })

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      docExpansion: 'none',
    },
    customJsStr: `
      // Auto-authorize after POST /auth/login
      (function waitForSwagger() {
        const interval = setInterval(function () {
          const ui = window.ui || window.swaggerUIBundle;
          if (!ui) return;
          clearInterval(interval);

          const origResponseInterceptor = ui.getConfigs().responseInterceptor;
          ui.getConfigs().responseInterceptor = function (res) {
            try {
              if (res.url && res.url.includes('/auth/login') && res.status >= 200 && res.status < 300) {
                const body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
                if (body && body.accessToken) {
                  ui.preauthorizeApiKey('access-token', body.accessToken);
                  console.info('[Swagger] Logged in — Bearer token set automatically.');
                }
              }
            } catch (e) {}
            return origResponseInterceptor ? origResponseInterceptor(res) : res;
          };
        }, 200);
      })();
    `,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  })

  const port = process.env.PORT ?? 4000
  await app.listen(port)
  console.log(`Backend running at http://localhost:${port}/api`)
}

bootstrap()
