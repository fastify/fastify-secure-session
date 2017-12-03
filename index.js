'use strict'

const fp = require('fastify-plugin')
const sodium = require('sodium-universal')
const kObj = Symbol('object')

module.exports = fp(function (fastify, options, next) {
  if (!options.secret || Buffer.byteLength(options.secret) < sodium.crypto_secretbox_KEYBYTES) {
    return next(new Error(`secret must be at least ${sodium.crypto_secretbox_KEYBYTES}`))
  }

  const secret = Buffer.from(options.secret)
  const cookieName = options.cookieName || 'session'
  const cookieOptions = options.cookieOptions || {}

  // just to add something to the shape
  // TODO verify if it helps the perf
  fastify.decorateRequest('session', null)

  fastify
    .register(require('fastify-cookie'))
    .register(fp(addHooks))

  next()

  function addHooks (fastify, options, next) {
    // the hooks must be registered after fastify-cookie hooks

    fastify.addHook('preHandler', function decodeSession (request, reply, next) {
      const cookie = request.cookies[cookieName]
      if (cookie === undefined) {
        // there is no cookie
        request.session = new Session({})
        next()
        return
      }

      const [cyphertextB64, nonceB64] = cookie.split(';')

      const cipher = Buffer.from(cyphertextB64, 'base64')
      const nonce = Buffer.from(nonceB64, 'base64')

      if (cipher.length < sodium.crypto_secretbox_MACBYTES) {
        // not long enough
        request.session = new Session({})
        next()
        return
      }

      const msg = Buffer.allocUnsafe(cipher.length - sodium.crypto_secretbox_MACBYTES)
      if (!sodium.crypto_secretbox_open_easy(msg, cipher, nonce, secret)) {
        // unable to decrypt
        request.session = new Session({})
        next()
        return
      }

      request.session = new Session(JSON.parse(msg))
      next()
    })

    fastify.addHook('onSend', function encodeSession (request, reply, payload, next) {
      const session = request.session

      if (!session.changed) {
        // nothing to do
        next()
        return
      }

      const nonce = genNonce()
      const msg = Buffer.from(JSON.stringify(session[kObj]))

      const cipher = Buffer.allocUnsafe(msg.length + sodium.crypto_secretbox_MACBYTES)
      sodium.crypto_secretbox_easy(cipher, msg, nonce, secret)

      reply.setCookie(cookieName, cipher.toString('base64') + ';' + nonce.toString('base64'), cookieOptions)
      next()
    })

    next()
  }
}, '>= 0.35.0')

class Session {
  constructor (obj) {
    this[kObj] = obj
    this.changed = false
  }

  get (key) {
    return this[kObj][key]
  }

  set (key, value) {
    this.changed = true
    this[kObj][key] = value
  }
}

function genNonce () {
  var buf = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(buf)
  return buf
}
