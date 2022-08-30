import SecureSessionPlugin, { Session, SessionData } from "..";
import fastify, {
  FastifyRequest,
  FastifyInstance,
  FastifyReply,
} from "fastify";
import { expectType } from "tsd";

const app: FastifyInstance = fastify();
app.register(SecureSessionPlugin);
app.register(SecureSessionPlugin, { key: "foobar" });
app.register(SecureSessionPlugin, { key: Buffer.from("foo") });
app.register(SecureSessionPlugin, { key: ["foo", "bar"] });
app.register(SecureSessionPlugin, { secret: "foo", salt: "bar" });

declare module ".." {
  interface SessionData {
    foo: string;
  }
}

app.get("/not-websockets", async (request, reply) => {
  expectType<FastifyRequest>(request);
  expectType<FastifyReply>(reply);
  expectType<Session>(request.session);
  request.session.set("foo", "bar");
  expectType<string | undefined>(request.session.get("foo"));
  expectType<any>(request.session.get("baz"));
  expectType<string | undefined>(request.session.foo);
  expectType<any>(request.session.baz);
  expectType<SessionData | undefined>(request.session.data());
  request.session.delete();
  request.session.options({ maxAge: 42 });
});

expectType<Session | null>(app.decodeSecureSession("some cookie"))
let session = app.createSecureSession({foo: 'bar'});
expectType<Session>(session);
session = app.createSecureSession();
expectType<Session>(session);
expectType<string>(app.encodeSecureSession(session))
