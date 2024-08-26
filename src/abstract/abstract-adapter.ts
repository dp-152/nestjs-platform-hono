import type { INestApplication, RequestHandler } from "@nestjs/common/interfaces";
import type { Context, Env, HonoRequest, MiddlewareHandler, Schema } from "hono";
import type { H } from "hono/types";
import type { RedirectStatusCode, StatusCode } from "hono/utils/http-status";

import type { Data, TODO } from "../types";

import { RequestMethod, StreamableFile } from "@nestjs/common";
import { AbstractHttpAdapter } from "@nestjs/core";
import { Hono } from "hono";

export type InitFn<E extends Env, S extends Schema, P extends string> = (
  app: Hono<any, any, any>
) => Hono<E, S, P>;

export type InitApp<E extends Env, S extends Schema, P extends string> =
  | Hono<E, S, P>
  | InitFn<E, S, P>;

export interface NestHonoApplication<
  TEnv extends Env,
  TSchema extends Schema,
  TBasePath extends string,
  TServer
> extends INestApplication<TServer> {
  getHttpAdapter(): HonoAdapter<TEnv, TSchema, TBasePath, TServer>;
  use<E extends Env = TEnv>(...handlers: MiddlewareHandler<E, TBasePath>[]): this;
  use<E extends Env = TEnv>(path: string, ...handlers: MiddlewareHandler<E, TBasePath>[]): this;
  listen(port: string | number, callback?: () => void): Promise<void>;
  listen(port: string | number, hostname: string, callback?: () => void): Promise<void>;
}

const METHODS = {
  [RequestMethod.GET]: "GET",
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.DELETE]: "DELETE",
  [RequestMethod.PATCH]: "PATCH",
  [RequestMethod.ALL]: "ALL",
  [RequestMethod.OPTIONS]: "OPTIONS",
  [RequestMethod.HEAD]: "HEAD",
  [RequestMethod.SEARCH]: "SEARCH",
}

export abstract class HonoAdapter<
  TEnv extends Env,
  TSchema extends Schema,
  TBasePath extends string,
  TServer
> extends AbstractHttpAdapter<TServer, HonoRequest<TBasePath>, Context<TEnv, TBasePath>> {
  declare protected instance: Hono<TEnv, TSchema, TBasePath>;

  constructor(initApp?: InitApp<TEnv, TSchema, TBasePath>) {
    if (!initApp) {
      initApp = new Hono();
    }
    if (typeof initApp === "function") {
      initApp = initApp(new Hono());
    }
    super(initApp);
  }

  private addCompat(context: Context<any, any, any>) {
    return Object.defineProperties(context, {
      type: {
        value: function _type(t: string) {
          context.header('Content-Type', t);
        }
      },
      send: {
        value: function _send(value: string) {
          return context.res = context.body(value);
        }
      }
    });
  }

  protected createHandler(handler: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>): H {
    return (h, next) => Promise.resolve()
      .then(() => this.addCompat(h))
      .then((h) => handler(h.req, h, next))
      .then(() => h.finalized = true);
  }

  protected addHandler(handler: RequestHandler<HonoRequest<TBasePath>>, method?: string, path?: string) {
    method ??= "ALL";
    path ??= "*";
    this.instance.on(method.toUpperCase(), path, this.createHandler(handler));
    return this;
  }

  protected addRoute(
    method: string,
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    const path = typeof pathOrHandler === "string" ? pathOrHandler : undefined;
    const h = handler ?? pathOrHandler as RequestHandler
    return this.addHandler(h, method, path);
  }

  protected handleStreamable(context: Context<TEnv, TBasePath>, streamable: StreamableFile) {
    for (const [key, value] of Object.entries(streamable.getHeaders())) {
      const header = `content-${key}`;
      if (!context.res.headers.has(header)) {
        context.res.headers.set(header, value.toString());
      }
    }
    return this.handleStream(context, streamable.getStream());
  }

  protected abstract handleStream(context: Context<TEnv, TBasePath>, source: unknown): Response;

  public override use<E extends Env = TEnv>(...handlers: MiddlewareHandler<E, TBasePath>[]): this;
  public override use<E extends Env = TEnv>(path: string, ...handlers: MiddlewareHandler<E, TBasePath>[]): this;
  public override use(...args: unknown[]) {
    this.instance.use(...args as any);
    return this;
  }

  public override get(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("get", pathOrHandler, handler)
  }

  public override post(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("post", pathOrHandler, handler)
  }

  public override head(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("head", pathOrHandler, handler)
  }

  public override delete(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("delete", pathOrHandler, handler)
  }

  public override put(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("put", pathOrHandler, handler)
  }

  public override patch(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("patch", pathOrHandler, handler)
  }

  public override options(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("options", pathOrHandler, handler)
  }

  public override search(
    pathOrHandler: string | RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>,
    handler?: RequestHandler<HonoRequest<TBasePath>, Context<TEnv>>
  ) {
    return this.addRoute("search", pathOrHandler, handler)
  }

  override setViewEngine(..._: TODO): TODO {
    throw new Error("Method not implemented.");
  }

  override getRequestHostname(request: HonoRequest<TBasePath>) {
    const req: any = request;
    if (!req.__url) {
      req.__url = new URL(request.url);
    }
    return req.__url.hostname;
  }

  override getRequestMethod(request: HonoRequest<TBasePath>) {
    return request.method;
  }

  override getRequestUrl(request: HonoRequest<TBasePath>) {
    return request.url;
  }

  override status(context: Context<TEnv, TBasePath>, statusCode: StatusCode) {
    context.status(statusCode as any);
    return context;
  }

  override reply(context: Context<TEnv, TBasePath>, body: Data, statusCode?: StatusCode) {
    context.status(statusCode as any);
    if (body instanceof StreamableFile) {
      context.res = this.handleStreamable(context, body);
    }
    context.res = context.json(body);
    return context;
  }

  override end(context: Context<TEnv, TBasePath>, message?: string) {
    if (message) {
      context.body(message);
    };
    return context;
  }

  override render(..._: TODO): TODO {
    throw new Error("Method not implemented.");
  }

  override redirect(context: Context<TEnv, TBasePath>, statusCode: RedirectStatusCode, url: string) {
    return context.redirect(url, statusCode);
  }

  override setErrorHandler<P extends string = TBasePath>(handler: TODO, prefix?: P) {
    const h: H<TEnv> = async (h, next) => {
      if (!h.error) {
        await next();
      }
      if (!h.error) {
        return;
      }
      return handler(h.error, h.req, h, next)
    }
    if (prefix) {
      return this.instance.use(prefix, h);
    }
    return this.instance.use(h);
  }

  override setNotFoundHandler<P extends string = TBasePath>(handler: TODO, prefix?: P) {
    return this.addHandler(handler, "ALL", prefix);
  }

  override isHeadersSent(context: Context<TEnv, TBasePath>) {
    return context.finalized;
  }

  override getHeader(context: Context<TEnv, TBasePath>, name: string) {
    return context.res.headers.get(name);
  }

  override setHeader(context: Context<TEnv, TBasePath>, name: string, value: string) {
    return context.res.headers.set(name, value);
  }

  override appendHeader(context: Context<TEnv, TBasePath>, name: string, value: string) {
    return context.res.headers.append(name, value);
  }

  override registerParserMiddleware<P extends string = TBasePath>(prefix?: P, rawBody?: boolean): TODO {
    return this.instance.use(prefix || "*", async (h, next) => {
      if (rawBody) {
        (h.req as TODO)["rawBody"] = await h.req.arrayBuffer().then(Buffer.from);
      }
      const header = h.req.header("content-type");
      if (header?.startsWith("application/json")) {
        (h.req as TODO)["body"] = await h.req.json();
        return next();
      }
      if (header?.startsWith("application/x-www-form-urlencoded")) {
        (h.req as TODO)["body"] = await h.req.formData();
        return next();
      }
      (h.req as TODO)["body"] = await h.req.text().then(body => body || undefined);
      return next();
    })
  }

  override enableCors(..._: TODO): TODO {
    throw new Error("Method not implemented.");
  }

  override createMiddlewareFactory(requestMethod: RequestMethod) {
    return (path: string, handler: Function) => {
      this.addHandler(handler as any, METHODS[requestMethod], path);
    }
  }

  override getType(): string {
    return "hono";
  }
}
