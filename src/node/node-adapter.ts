import type { ServerType } from "@hono/node-server";
import type { ServeStaticOptions as HonoServeStaticOptions } from "@hono/node-server/serve-static";
import type { NestApplicationOptions } from "@nestjs/common";
import type { Context, Env, Schema } from "hono";

import type { InitApp, NestHonoApplication } from "../abstract/abstract-adapter";
import type { TODO } from "../types";

import type { StreamInput } from "./helpers/stream";

import { createServer as createHTTPServer } from "node:http";
import { createServer as createHTTPSServer } from "node:https";
import { relative } from "node:path";

import { createAdaptorServer } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { HonoAdapter } from "../abstract/abstract-adapter";

import { handleStream } from "./helpers/stream";

export interface NodeServeStaticOptions extends HonoServeStaticOptions {
  prefix?: string;
}

export interface NestHonoNodeApplication<
  TEnv extends Env = Env,
  TSchema extends Schema = Schema,
  TBasePath extends string = "/",
> extends NestHonoApplication<TEnv, TSchema, TBasePath, ServerType> {
  getHttpAdapter(): HonoNodeAdapter<TEnv, TSchema, TBasePath>;
}

export class HonoNodeAdapter<
  TEnv extends Env,
  TSchema extends Schema,
  TBasePath extends string,
> extends HonoAdapter<TEnv, TSchema, TBasePath, ServerType> {
  constructor(initApp?: InitApp<TEnv, TSchema, TBasePath>) {
    super(initApp);
  }

  override initHttpServer(options: NestApplicationOptions) {
    this.setHttpServer(createAdaptorServer({
      fetch: this.instance.fetch,
      serverOptions: options.httpsOptions,
      createServer: options.httpsOptions ? createHTTPSServer : createHTTPServer as any
    }));
  }

  override useStaticAssets(options: NodeServeStaticOptions): this
  override useStaticAssets(rootOrOptions: string | NodeServeStaticOptions, options?: NodeServeStaticOptions) {
    if (!options) {
      options = {};
    }
    if (typeof rootOrOptions === "object") {
      options = rootOrOptions;
    } else {
      options.root = relative(process.cwd(), rootOrOptions);
    }
    if (options.prefix) {
      options.rewriteRequestPath = (path) => {
        return relative(options.prefix!, path);
      }
      this.instance.use(`${options.prefix}/*`, serveStatic(options));
    } else {
      this.instance.use(serveStatic(options));
    }
    return this;
  }

  protected override handleStream(context: Context<TEnv, TBasePath>, source: StreamInput) {
    return handleStream(context, source);
  }

  override listen(port: string | number, callback?: () => void): Promise<void>;
  override listen(port: string | number, hostname: string, callback?: () => void): Promise<void>;
  override listen(port: string | number, hostnameOrCb?: string | (() => void), callback?: () => void) {
    let cb = () => { };
    let hostname: string | undefined;
    if (typeof hostnameOrCb === "string") {
      hostname = hostnameOrCb;
      cb = callback ?? cb;
    } else {
      cb = hostnameOrCb ?? cb;
    }
    return Promise.resolve()
      .then(() => this.getHttpServer().listen(+port, hostname))
      .then(() => cb());
  }

  override applyVersionFilter(..._: TODO): TODO {
    throw new Error("Method not implemented.");
  }

  override close() {
    return new Promise<void>((res) => this.getHttpServer().close(() => res()));
  }
}
