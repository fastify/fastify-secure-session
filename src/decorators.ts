import { FastifyLoggerInstance, FastifyPluginCallback } from 'fastify'
import sodium from 'sodium-native'
import { kObj, Session, SessionData } from './Session'
import { genNonce } from './utils'

export type SecureSessionDecoratorsOptions = { secretKeys: Buffer[] }

export const addDecorators: FastifyPluginCallback<SecureSessionDecoratorsOptions> = (fastify, { secretKeys }, next) => {
  // just to add something to the shape
  // TODO verify if it helps the perf
  fastify.decorateRequest('session', null)

  fastify.decorate('createSecureSession', <T extends SessionData = SessionData>(data: T) => new Session(data))

  fastify.decorate(
    'decodeSecureSession',
    (cookie: string | undefined, log: FastifyLoggerInstance = fastify.log): null | Session => {
      if (cookie === undefined) {
        // there is no cookie
        log.debug('fastify-secure-session: there is no cookie, creating an empty session')
        return null
      }

      // do not use destructuring or it will deopt
      const split = cookie.split(';')
      const cyphertextB64 = split[0]
      const nonceB64 = split[1]

      if (split.length <= 1) {
        // the cookie is malformed
        log.debug('fastify-secure-session: the cookie is malformed, creating an empty session')
        return null
      }

      const cipher = Buffer.from(cyphertextB64, 'base64')
      const nonce = Buffer.from(nonceB64, 'base64')

      if (cipher.length < sodium.crypto_secretbox_MACBYTES) {
        // not long enough
        log.debug('fastify-secure-session: the cipher is not long enough, creating an empty session')
        return null
      }

      if (nonce.length !== sodium.crypto_secretbox_NONCEBYTES) {
        // the length is not correct
        log.debug('fastify-secure-session: the nonce does not have the required length, creating an empty session')
        return null
      }

      const msg = Buffer.allocUnsafe(cipher.length - sodium.crypto_secretbox_MACBYTES)

      let signingKeyRotated = false
      const decodeSuccess = secretKeys.some((secretKey, index) => {
        const decoded = sodium.crypto_secretbox_open_easy(msg, cipher, nonce, secretKey)

        signingKeyRotated = decoded && index > 0

        return decoded
      })

      if (!decodeSuccess) {
        // unable to decrypt
        log.debug('fastify-secure-session: unable to decrypt, creating an empty session')
        return null
      }

      const session = new Session(JSON.parse(msg.toString()))
      session.changed = signingKeyRotated
      return session
    }
  )

  fastify.decorate('encodeSecureSession', (session: Session): string => {
    const nonce = genNonce()
    const msg = Buffer.from(JSON.stringify(session[kObj]))

    const cipher = Buffer.allocUnsafe(msg.length + sodium.crypto_secretbox_MACBYTES)
    sodium.crypto_secretbox_easy(cipher, msg, nonce, secretKeys[0])

    return cipher.toString('base64') + ';' + nonce.toString('base64')
  })

  next()
}
