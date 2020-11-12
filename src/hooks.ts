import type { FastifyPluginCallback } from 'fastify'
import type { CookieSerializeOptions } from 'fastify-cookie'
import { kCookieOptions, Session } from './Session'

export type SecureSessionHooksOptions = { cookieName: string; cookieOptions: CookieSerializeOptions }

export const addHooks: FastifyPluginCallback<SecureSessionHooksOptions> = (
  fastify,
  { cookieName, cookieOptions },
  next
) => {
  fastify.addHook('onRequest', (request, _reply, next) => {
    const cookie = request.cookies[cookieName]
    const result = fastify.decodeSecureSession(cookie, request.log)
    request.session = result || new Session({})
    next()
  })

  fastify.addHook('onSend', (request, reply, _payload, next) => {
    const session = request.session

    if (!session || !session.changed) {
      // nothing to do
      request.log.debug("fastify-secure-session: there is no session or the session didn't change, leaving it as is")
      next()
      return
    } else if (session.deleted) {
      request.log.debug('fastify-secure-session: deleting session')
      const tmpCookieOptions = Object.assign({}, cookieOptions, session[kCookieOptions], {
        expires: new Date(0),
        maxAge: 0,
      })
      reply.setCookie(cookieName, '', tmpCookieOptions)
      next()
      return
    }

    request.log.debug('fastify-secure-session: setting session')
    reply.setCookie(
      cookieName,
      fastify.encodeSecureSession(session),
      Object.assign({}, cookieOptions, session[kCookieOptions])
    )

    next()
  })

  next()
}
