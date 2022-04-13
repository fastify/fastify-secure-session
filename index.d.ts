/// <reference types="node" />
import { CookieSerializeOptions } from "fastify-cookie";
import { FastifyPlugin, FastifyLoggerInstance } from "fastify";

export interface Session {
  changed: boolean;
  deleted: boolean;
  get<Key extends keyof SessionData>(key: Key): SessionData[Key] | undefined;
  set<Key extends keyof SessionData>(key: Key, value: SessionData[Key] | undefined): void;
  delete(): void;
  options(opts: CookieSerializeOptions): void;
}

export interface SessionData {
  [key: string]: any;
}

export type SecureSessionPluginOptions = {
  cookie?: CookieSerializeOptions
  cookieName?: string
} & ({key: string | Buffer | (string | Buffer)[]} | {
  secret: string | Buffer,
  salt: string | Buffer
})

declare const SecureSessionPlugin: FastifyPlugin<SecureSessionPluginOptions>;

export default SecureSessionPlugin;

declare module "fastify" {
  interface FastifyInstance {
    createSecureSession(data?: Record<string, any>): Session
    decodeSecureSession(cookie: string, log?: FastifyLoggerInstance): Session | null
    encodeSecureSession(session: Session): string
  }

  interface FastifyRequest {
    session: Session;
  }
}
