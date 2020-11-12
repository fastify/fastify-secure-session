import { FastifyLoggerInstance } from 'fastify'
import { Session, SessionData } from '../Session'
declare module 'fastify' {
  interface FastifyInstance {
    createSecureSession: <T extends SessionData = SessionData>(data: T) => Session
    decodeSecureSession: (cookie: string, log?: FastifyLoggerInstance) => Session | null
    encodeSecureSession: (session: Session) => string
  }
  interface FastifyRequest {
    session: Session | null
  }
}
