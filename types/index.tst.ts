import SecureSessionPlugin, { Session, SessionData } from '.'
import fastify, {
  FastifyRequest,
  FastifyInstance,
  FastifyReply
} from 'fastify'
import { expect } from 'tstyche'

const app: FastifyInstance = fastify()
app.register(SecureSessionPlugin, { key: 'foobar' })
app.register(SecureSessionPlugin, { key: Buffer.from('foo') })
app.register(SecureSessionPlugin, { key: ['foo', 'bar'] })
app.register(SecureSessionPlugin, { secret: 'foo', salt: 'bar' })
app.register(SecureSessionPlugin, { sessionName: 'foo', key: 'bar' })
app.register(SecureSessionPlugin, { expiry: 24 * 60 * 60, key: 'bar' })
app.register(SecureSessionPlugin, [
  { sessionName: 'foo', key: 'bar' },
  { sessionName: 'bar', key: 'bar' }
])

declare module '..' {
  interface SessionData {
    foo: string;
  }
}

interface FooSessionData {
  foo: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    foo: Session<FooSessionData>;
  }
}

app.get('/not-websockets', async (request, reply) => {
  expect(request).type.toBeAssignableTo<FastifyRequest>()
  expect(reply).type.toBeAssignableTo<FastifyReply>()
  expect(request.session).type.toBe<Session>()
  request.session.set('foo', 'bar')
  expect(request.session.get('foo')).type.toBe<string | undefined>()
  expect(request.session.get('baz')).type.toBe<any>()
  expect(request.session.foo).type.toBe<string | undefined>()
  expect(request.session.data()).type.toBe<
    SessionData | undefined
  >()
  request.session.delete()
  request.session.options({ maxAge: 42 })
  request.session.touch()

  request.foo.set('foo', 'bar')
  expect(request.foo.get('foo')).type.toBe<string | undefined>()
  expect(request.foo.get('baz')).type.toBe<any>()
  request.foo.delete()
  request.foo.options({ maxAge: 42 })
  request.foo.touch()

  expect(request.session.set).type.not.toBeCallableWith('baz', 'bar')
  expect(request.session).type.not.toHaveProperty('baz')
  expect(request).type.not.toHaveProperty('baz')
})

expect(app.decodeSecureSession('some cookie')).type.toBe<Session | null>()
let session = app.createSecureSession({ foo: 'bar' })
expect(session).type.toBe<Session>()

session = app.createSecureSession()
expect(session).type.toBe<Session>()

expect(app.encodeSecureSession(session)).type.toBe<string>()
