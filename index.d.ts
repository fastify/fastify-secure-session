/// <reference types="node" />
import { CookieSerializeOptions } from "fastify-cookie";
import { FastifyPlugin, FastifyLoggerInstance } from "fastify";

export class Session {
  changed: boolean;
  deleted: boolean;
  get(key: string): any;
  set(key: string, value: any): void;
  delete(): void;
}

export type SecureSessionPluginOptions = {
  cookie?: CookieSerializeOptions
} & ({key: string | Buffer | (string | Buffer)[]} | {
  secret: string | Buffer,
  salt: string | Buffer
})

declare const SecureSessionPlugin: FastifyPlugin<SecureSessionPluginOptions>;

export default SecureSessionPlugin;

declare module "fastify" {
  interface FastifyInstance {
    decodeSecureSession(cookie: string, log?: FastifyLoggerInstance): Session | null
    encodeSecureSession(session: Session): string
  }

  interface FastifyRequest {
    session: Session;
  }
}
