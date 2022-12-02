/// <reference types="node" />
import { CookieSerializeOptions } from "@fastify/cookie";
import { FastifyPluginCallback, FastifyBaseLogger } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    createSecureSession(data?: Record<string, any>): fastifySecureSession.Session
    decodeSecureSession(cookie: string, log?: FastifyBaseLogger): fastifySecureSession.Session | null
    encodeSecureSession(session: fastifySecureSession.Session): string
  }

  interface FastifyRequest {
    session: fastifySecureSession.Session;
  }
}

type FastifySecureSession = FastifyPluginCallback<fastifySecureSession.SecureSessionPluginOptions>;

declare namespace fastifySecureSession {
  export type Session = Partial<SessionData> & {
    changed: boolean;
    deleted: boolean;
    get<Key extends keyof SessionData>(key: Key): SessionData[Key] | undefined;
    set<Key extends keyof SessionData>(key: Key, value: SessionData[Key] | undefined): void;
    data(): SessionData | undefined;
    delete(): void;
    options(opts: CookieSerializeOptions): void;
  }

  export interface SessionData {
    [key: string]: any;
  }

  export type SecureSessionPluginOptions = {
    cookie?: CookieSerializeOptions
    cookieName?: string
  } & ({ key: string | Buffer | (string | Buffer)[] } | {
    secret: string | Buffer,
    salt: string | Buffer
  })

  export const fastifySecureSession: FastifySecureSession
  export { fastifySecureSession as default }
}

declare function fastifySecureSession(...params: Parameters<FastifySecureSession>): ReturnType<FastifySecureSession>
export = fastifySecureSession
