/// <reference types="node" />
import { CookieSerializeOptions } from "fastify-cookie";
import { FastifyPlugin } from "fastify";

export interface Session {
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
  salt: string | Buffer,
  muteLogs?: boolean,
})

declare const SecureSessionPlugin: FastifyPlugin<SecureSessionPluginOptions>;

export default SecureSessionPlugin;

declare module "fastify" {
  interface FastifyRequest {
    session: Session;
  }
}
