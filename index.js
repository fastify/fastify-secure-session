'use strict'

const fp = require('fastify-plugin')
const sodium = require('sodium-native')
const kObj = Symbol('object')
const kCookieOptions = Symbol('cookie options')

// allows us to use property getters and setters as well as get and set methods on session object
const sessionProxyHandler = {
  get (target, prop) {
    // Calling functions eg request[sessionName].get('key') or request[sessionName].set('key', 'value')
    if (typeof target[prop] === 'function') {
      return new Proxy(target[prop], {
        apply (applyTarget, _thisArg, args) {
          return Reflect.apply(applyTarget, target, args)
        }
      })
    }

    // accessing own properties, eg request[sessionName].changed
    if (Object.hasOwn(target, prop)) {
      return target[prop]
    }

    // accessing session property
    return target.get(prop)
  },
  set (target, prop, value) {
    // modifying own properties, eg request[sessionName].changed
    if (Object.hasOwn(target, prop)) {
      target[prop] = value
      return true
    }

    // modifying session property
    target.set(prop, value)
    return true
  }
}

function fastifySecureSession (fastify, options, next) {
  if (!Array.isArray(options)) {
    options = [options]
  }

  let defaultSessionName
  let defaultSecret
  const sessionNames = new Map()

  for (const sessionOptions of options) {
    const sessionName = sessionOptions.sessionName || 'session'
    const cookieName = sessionOptions.cookieName || sessionName
    const expiry = sessionOptions.expiry || 86401 // 24 hours
    const cookieOptions = sessionOptions.cookieOptions || sessionOptions.cookie || {}

    if (cookieOptions.httpOnly === undefined) {
      cookieOptions.httpOnly = true
    }

    let key

    if (sessionOptions.secret && !sessionOptions.key) {
      if (Buffer.byteLength(sessionOptions.secret) < 32) {
        return next(new Error('secret must be at least 32 bytes'))
      }

      key = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)

      // static salt to be used for key derivation, not great for security,
      // but better than nothing
      let salt = Buffer.from('mq9hDxBVDbspDR6nLfFT1g==', 'base64')

      if (sessionOptions.salt) {
        salt = (Buffer.isBuffer(sessionOptions.salt)) ? sessionOptions.salt : Buffer.from(sessionOptions.salt, 'ascii')
      }

      if (Buffer.byteLength(salt) !== sodium.crypto_pwhash_SALTBYTES) {
        return next(new Error('salt must be length ' + sodium.crypto_pwhash_SALTBYTES))
      }

      sodium.crypto_pwhash(key,
        Buffer.from(sessionOptions.secret),
        salt,
        sodium.crypto_pwhash_OPSLIMIT_MODERATE,
        sodium.crypto_pwhash_MEMLIMIT_MODERATE,
        sodium.crypto_pwhash_ALG_DEFAULT)

      defaultSecret = sessionOptions.secret
    }

    if (sessionOptions.key) {
      key = sessionOptions.key
      if (typeof key === 'string') {
        key = Buffer.from(key, 'base64')
      } else if (Array.isArray(key)) {
        try {
          key = key.map(ensureBufferKey)
        } catch (error) {
          return next(error)
        }
      } else if (!Buffer.isBuffer(key)) {
        return next(new Error('key must be a string or a Buffer'))
      }

      if (!Array.isArray(key) && isBufferKeyLengthInvalid(key)) {
        return next(new Error(`key must be ${sodium.crypto_secretbox_KEYBYTES} bytes`))
      } else if (Array.isArray(key) && key.every(isBufferKeyLengthInvalid)) {
        return next(new Error(`key lengths must be ${sodium.crypto_secretbox_KEYBYTES} bytes`))
      }

      const outputHash = Buffer.alloc(sodium.crypto_generichash_BYTES)

      if (Array.isArray(key)) {
        sodium.crypto_generichash(outputHash, key[0])
      } else {
        sodium.crypto_generichash(outputHash, key)
      }

      defaultSecret = outputHash.toString('hex')
    }

    if (!key) {
      return next(new Error('key or secret must specified'))
    }

    if (!Array.isArray(key)) {
      key = [key]
    }

    // just to add something to the shape
    // TODO verify if it helps the perf
    fastify.decorateRequest(sessionName, null)

    sessionNames.set(sessionName, {
      cookieName,
      cookieOptions,
      key,
      expiry
    })

    if (!defaultSessionName) {
      defaultSessionName = sessionName
    }
  }

  fastify.decorate('decodeSecureSession', (cookie, log = fastify.log, sessionName = defaultSessionName) => {
    if (cookie === undefined) {
      // there is no cookie
      log.trace('@fastify/secure-session: there is no cookie, creating an empty session')
      return null
    }

    if (!sessionNames.has(sessionName)) {
      throw new Error('Unknown session key.')
    }

    const { key, expiry } = sessionNames.get(sessionName)

    // do not use destructuring or it will deopt
    const split = cookie.split(';')
    const cyphertextB64 = split[0]
    const nonceB64 = split[1]

    if (split.length <= 1) {
      // the cookie is malformed
      log.debug('@fastify/secure-session: the cookie is malformed, creating an empty session')
      return null
    }

    const cipher = Buffer.from(cyphertextB64, 'base64')
    const nonce = Buffer.from(nonceB64, 'base64')

    if (cipher.length < sodium.crypto_secretbox_MACBYTES) {
      // not long enough
      log.debug('@fastify/secure-session: the cipher is not long enough, creating an empty session')
      return null
    }

    if (nonce.length !== sodium.crypto_secretbox_NONCEBYTES) {
      // the length is not correct
      log.debug('@fastify/secure-session: the nonce does not have the required length, creating an empty session')
      return null
    }

    const msg = Buffer.allocUnsafe(cipher.length - sodium.crypto_secretbox_MACBYTES)

    let signingKeyRotated = false
    const decodeSuccess = key.some((k, i) => {
      const decoded = sodium.crypto_secretbox_open_easy(msg, cipher, nonce, k)

      signingKeyRotated = decoded && i > 0

      return decoded
    })

    if (!decodeSuccess) {
      // unable to decrypt
      log.debug('@fastify/secure-session: unable to decrypt, creating an empty session')
      return null
    }

    const parsed = JSON.parse(msg)
    if ((parsed.__ts + expiry) * 1000 - Date.now() <= 0) {
      // maximum validity is reached, resetting
      log.debug('@fastify/secure-session: expiry reached')
      return null
    }
    const session = new Proxy(new Session(parsed), sessionProxyHandler)
    session.changed = signingKeyRotated

    return session
  })

  fastify.decorate('createSecureSession', (data) => new Proxy(new Session(data), sessionProxyHandler))

  fastify.decorate('encodeSecureSession', (session, sessionName = defaultSessionName) => {
    if (!sessionNames.has(sessionName)) {
      throw new Error('Unknown session key.')
    }

    const { key } = sessionNames.get(sessionName)

    const nonce = genNonce()
    const msg = Buffer.from(JSON.stringify(session[kObj]))

    const cipher = Buffer.allocUnsafe(msg.length + sodium.crypto_secretbox_MACBYTES)
    sodium.crypto_secretbox_easy(cipher, msg, nonce, key[0])

    return cipher.toString('base64') + ';' + nonce.toString('base64')
  })

  if (fastify.hasPlugin('@fastify/cookie')) {
    fastify
      .register(fp(addHooks))
  } else {
    fastify
      .register(require('@fastify/cookie'), {
        secret: defaultSecret
      })
      .register(fp(addHooks))
  }

  next()

  function addHooks (fastify, _options, next) {
    // the hooks must be registered after @fastify/cookie hooks

    fastify.addHook('onRequest', (request, _reply, next) => {
      for (const [sessionName, { cookieName, cookieOptions }] of sessionNames.entries()) {
        let cookie = request.cookies[cookieName]

        if (cookie !== undefined && cookieOptions.signed === true) {
          const unsignedCookie = fastify.unsignCookie(cookie)

          if (unsignedCookie.valid === true) {
            cookie = unsignedCookie.value
          }
        }

        const result = fastify.decodeSecureSession(cookie, request.log, sessionName)

        request[sessionName] = result || new Proxy(new Session({}), sessionProxyHandler)
      }

      next()
    })

    fastify.addHook('onSend', (request, reply, _payload, next) => {
      for (const [sessionName, { cookieName, cookieOptions }] of sessionNames.entries()) {
        const session = request[sessionName]

        if (!session || !session.changed) {
        // nothing to do
          request.log.trace('@fastify/secure-session: there is no session or the session didn\'t change, leaving it as is')
          continue
        } else if (session.deleted) {
          request.log.debug('@fastify/secure-session: deleting session')
          const tmpCookieOptions = Object.assign(
            {},
            cookieOptions,
            session[kCookieOptions],
            { expires: new Date(0), maxAge: 0 }
          )
          reply.setCookie(cookieName, '', tmpCookieOptions)
          continue
        }

        request.log.trace('@fastify/secure-session: setting session')
        reply.setCookie(
          cookieName,
          fastify.encodeSecureSession(session, sessionName),
          Object.assign({}, cookieOptions, session[kCookieOptions])
        )
      }

      next()
    })

    next()
  }
}

class Session {
  constructor (obj) {
    this[kObj] = obj
    this[kCookieOptions] = null
    this.changed = false
    this.deleted = false

    if (this[kObj].__ts === undefined) {
      this[kObj].__ts = Math.round(Date.now() / 1000)
    }
  }

  get (key) {
    return this[kObj][key]
  }

  set (key, value) {
    this.touch()
    this[kObj][key] = value
  }

  delete () {
    this.deleted = true
    this.touch()
  }

  options (opts) {
    this[kCookieOptions] = opts
  }

  data () {
    const copy = {
      ...this[kObj]
    }

    delete copy.__ts
    return copy
  }

  touch () {
    this.changed = true
    this[kObj].__ts = Math.round(Date.now() / 1000)
  }

  regenerate (ignoredFields) {
    for (const key of Object.keys(this[kObj])) {
      if (key === '__ts' || (Array.isArray(ignoredFields) && ignoredFields.includes(key))) {
        continue
      }
      delete this[kObj][key]
    }
    this.touch()
  }
}

function genNonce () {
  const buf = Buffer.allocUnsafe(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(buf)
  return buf
}

function ensureBufferKey (k) {
  if (Buffer.isBuffer(k)) {
    return k
  }

  if (typeof k !== 'string') {
    throw new TypeError('Key must be string or buffer')
  }

  return Buffer.from(k, 'base64')
}

function isBufferKeyLengthInvalid (k) {
  // the key should be strictly equals to sodium.crypto_secretbox_KEYBYTES
  // or this will result in a runtime error when encoding the session
  return k.length !== sodium.crypto_secretbox_KEYBYTES
}

module.exports = fp(fastifySecureSession, {
  fastify: '5.x',
  name: '@fastify/secure-session'
})
module.exports.default = fastifySecureSession
module.exports.fastifySecureSession = fastifySecureSession
