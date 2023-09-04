/// <reference types="node" />
import { CookieSerializeOptions } from "@fastify/cookie";
import { FastifyPluginCallback, FastifyBaseLogger } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    createSecureSession(data?: Record<string, any>): fastifySecureSession.Session
    decodeSecureSession(cookie: string, log?: FastifyBaseLogger, sessionName?: string): fastifySecureSession.Session | null
    encodeSecureSession(session: fastifySecureSession.Session, sessionName?: string): string
  }

  interface FastifyRequest {
    session: fastifySecureSession.Session;
  }
}

type FastifySecureSession = FastifyPluginCallback<fastifySecureSession.SecureSessionPluginOptions | (fastifySecureSession.SecureSessionPluginOptions & Required<Pick<fastifySecureSession.SecureSessionPluginOptions, 'sessionName'>>)[]>;

declare namespace fastifySecureSession {
  export type Session<T = SessionData> = Partial<T> & {
    changed: boolean;
    deleted: boolean;
    get<Key extends keyof T>(key: Key): T[Key] | undefined;
    get(key: string): any | undefined;
    set<Key extends keyof T>(key: Key, value: T[Key] | undefined): void;
    data(): T | undefined;
    delete(): void;
    options(opts: CookieSerializeOptions): void;
    touch(): void;
  }

  export interface SessionData {
    [key: string]: any;
  }

  export type SecureSessionPluginOptions = {
    cookie?: CookieSerializeOptions
    cookieName?: string
    sessionName?: string
  } & ({ key: string | Buffer | (string | Buffer)[] } | {
    secret: string | Buffer,
    salt: string | Buffer
  })

  export const fastifySecureSession: FastifySecureSession
  export { fastifySecureSession as default }
}

declare function fastifySecureSession(...params: Parameters<FastifySecureSession>): ReturnType<FastifySecureSession>
export = fastifySecureSession
