import type { HttpsOptions } from "@nestjs/common/interfaces/external/https-options.interface";
import type { Context, Env, Hono, Schema } from "hono";
import type { BlankEnv, BlankSchema } from "hono/types";

import type { InitApp } from "../abstract/abstract-adapter";

import type { Data } from "../types";

export abstract class CustomPlatform<
  TEnv extends Env = BlankEnv,
  TSchema extends Schema = BlankSchema,
  TBasePath extends string = "/",
  TServer = unknown,
  TStreamInput = unknown,
> {
  constructor(readonly initApp: InitApp<TEnv, TSchema, TBasePath>) { }

  abstract getContent(path: string, c: Context<TEnv>): Promise<Data | Response | null>
  abstract createServer(app: Hono<TEnv, TSchema, TBasePath>, httpsOptions?: HttpsOptions): TServer;
  abstract listen(server: TServer, port: number, hostname?: string): void | Promise<void>;
  abstract end(server: NoInfer<TServer>): void | Promise<void>;
  abstract pathResolve?(path: string): string
  abstract isDir?(path: string): boolean | undefined | Promise<boolean | undefined>
  abstract handleStream?(context: Context<NoInfer<TEnv>>, source: TStreamInput): Response;
}
