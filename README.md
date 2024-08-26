# ‼️ WARNING: This pacakage is *EXPERIMENTAL* and *HIGHLY UNSTABLE* !

This project is an experiment and is currently being developed merely as a proof of concept. It is not recommended to use this package in a production environment.

If you are looking to improve the performance of your NestJS application, consider using the [Fastify adapter](https://docs.nestjs.com/techniques/performance) instead.

# A [NestJS](https://nestjs.com/) Adapter for [Hono](https://hono.dev/)
This package provides a NestJS platform adapter (such as [the one for Fastify](https://docs.nestjs.com/techniques/performance#adapter)), allowing you to use Hono as the underlying engine for your NestJS application.

Currently supports basic routing, streaming and static file serving.

Not all use cases have been tested, and the package is still in its early stages of development, therefore errors and bugs are to be expected. Issues and PRs are welcome.

## Usage
- Add the package to your existing NestJS Project:
  ```bash
  npm install nestjs-platform-hono
  ```
- Update your `main.ts` file to use the adapter:
  ```typescript
  import { NestFactory } from '@nestjs/core';
  import { HonoNodeAdapter, type NestHonoNodeApplication } from 'nestjs-platform-hono/node';
  import { AppModule } from './app.module';

  async function bootstrap() {
    const app = await NestFactory.create<NestHonoNodeApplication>(
      AppModule,
      new HonoNodeAdapter(),
    );
    await app.listen(3000);
  }
  bootstrap();
  ```
- Optionally, pass an existing Hono instance to the adapter:
  ```typescript
  import { NestFactory } from '@nestjs/core';
  import { Hono } from 'hono';
  import { logger } from 'hono/logger';
  import { HonoNodeAdapter, type NestHonoNodeApplication } from 'nestjs-platform-hono/node';
  import { AppModule } from './app.module';

  async function bootstrap() {
    const hono = new Hono();
    const app = await NestFactory.create<NestHonoNodeApplication>(
      AppModule,
      new HonoNodeAdapter(hono),
    );

    // Add routes and middleware directly to the Hono instance, if needed
    hono.use(logger());
    hono.get('/hello', async (c) => {
      return c.text('Hello, World!');
    });

    // Add middleware to the NestJS app instance.
    // When adding middleware through the app, the handler function has the following signature:
    // (request: HonoRequest, context: Context, next: () => Promise<void>) => Promise<Response | void>;
    app.use(async (req, context, next) => {
      console.log('Request received:', req.url);
      await next();
      console.log('Request processed:', req.url, context.response.status);
    });

    await app.listen(3000);
  }
  bootstrap();
  ```
## TODO
- [ ] Add tests
- [ ] Add utility decorators
- [ ] Implement `enableCors()`
- [ ] Implement template rendering
- [ ] Bun/Deno native platform adapter?
- [ ] ???
