import type {
  NestApplicationOptions,
} from "@nestjs/common";
import type { Context, Env, Schema } from "hono";
import type { ServeStaticOptions as HonoServeStaticOptions } from "hono/serve-static";

import type { NestHonoApplication } from "../abstract/abstract-adapter";
import type { Data, TODO } from "../types";

import type { BlankEnv, BlankSchema } from "hono/types";

import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

import { HonoAdapter } from "../abstract/abstract-adapter";
import type { CustomPlatform } from "./custom-platform";

export interface ServeStaticConfig<TEnv extends Env> {
  getContent: (path: string, c: Context<TEnv>) => Promise<Data | Response | null>
  pathResolve?: (path: string) => string
  isDir?: (path: string) => boolean | undefined | Promise<boolean | undefined>
}

export interface ServeStaticOptions<TEnv extends Env> extends ServeStaticConfig<TEnv>, HonoServeStaticOptions<TEnv> {
  prefix?: string;
  getContent: (path: string, c: Context<TEnv>) => Promise<Data | Response | null>
  pathResolve?: (path: string) => string
  isDir?: (path: string) => boolean | undefined | Promise<boolean | undefined>
}

export interface NestCustomHonoApplication<
  TEnv extends Env = BlankEnv,
  TSchema extends Schema = BlankSchema,
  TBasePath extends string = "/",
  TServer = unknown,
  TStreamInput = unknown,
> extends NestHonoApplication<TEnv, TSchema, TBasePath, TServer> {
  getHttpAdapter(): CustomHonoAdapter<TEnv, TSchema, TBasePath, TServer, TStreamInput>;
}

export abstract class CustomHonoAdapter<
  TEnv extends Env,
  TSchema extends Schema,
  TBasePath extends string,
  TServer,
  TStreamInput
> extends HonoAdapter<TEnv, TSchema, TBasePath, TServer> {
  constructor(
    private readonly platform: CustomPlatform<
      TEnv,
      TSchema,
      TBasePath,
      TServer,
      TStreamInput
    >
  ) {
    let instance = platform.initApp;
    if (typeof platform.initApp === "function") {
      instance = platform.initApp(new Hono());
    }
    super(instance);
  }

  override async close() {
    if (!this.getHttpServer()) {
      return;
    }

    try {
      if (this.platform?.end) {
        await this.platform.end(this.getHttpServer());
      }
    } catch (err) {
      if ((err as any)?.code === "ERR_SERVER_NOT_RUNNING") {
        return;
      }
      throw err;
    }
  }

  protected override handleStream(context: Context<TEnv, TBasePath, {}>, source: unknown): Response {
    if (!this.platform.handleStream) {
      throw new Error("Cannot use stream without handleStream");
    }
    return this.platform.handleStream(context, source as TStreamInput);
  }

  override initHttpServer(options: NestApplicationOptions) {
    this.setHttpServer(this.platform.createServer(this.instance, options.httpsOptions));
  }

  override useStaticAssets(options: ServeStaticOptions<TEnv>): this
  override useStaticAssets(rootOrOptions: string | ServeStaticOptions<TEnv>, options?: ServeStaticOptions<TEnv>) {
    if (!options) {
      options = {
        getContent: this.platform.getContent,
        pathResolve: this.platform.pathResolve,
        isDir: this.platform.isDir,
      };
    }
    if (typeof rootOrOptions === "object") {
      options = Object.assign({}, rootOrOptions, options);
    } else {
      options.root = rootOrOptions;
    }
    if (options.prefix) {
      this.instance.use(`${options.prefix}/*`, serveStatic(options));
    } else {
      this.instance.use(serveStatic(options));
    }
    return this;
  }

  override getType(): string {
    return "hono-generic";
  }

  override applyVersionFilter(..._: TODO): TODO {
    throw new Error("Method not implemented.");
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
      .then(() => this.platform.listen(this.getHttpServer(), +port, hostname))
      .then(() => cb());
  }
}
