import type { ReadableStream as WebReadable } from "node:stream/web";

import type { Context } from "hono";

import { Readable as NodeReadable } from "stream";

import { stream } from "hono/streaming";

export type StreamInput = NodeReadable | WebReadable;

function isNodeStream(stream: StreamInput): stream is NodeReadable {
  return !!stream
    && "_readableState" in stream
    && "pipe" in stream
    && typeof stream.pipe === "function"
    && "on" in stream
    && typeof stream.on === "function";
}

export function handleStream(context: Context<any, any>, source: StreamInput): Response {
  return stream(context, async (s) => {
    if (isNodeStream(source)) {
      source = NodeReadable.toWeb(source);
    }

    s.pipe(source as ReadableStream);
  });
}
