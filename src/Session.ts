import type { FastifyCookieOptions } from 'fastify-cookie'

export const kObj = Symbol('object')
export const kCookieOptions = Symbol('cookie options')

export type SessionData = Record<string, unknown>

export class Session<T extends SessionData = SessionData> {
  changed: boolean
  deleted: boolean;
  [kObj]: Partial<T>;
  [kCookieOptions]: FastifyCookieOptions | null

  constructor(obj: Partial<T>) {
    this[kObj] = obj
    this[kCookieOptions] = null
    this.changed = false
    this.deleted = false
  }

  get(key: string) {
    return this[kObj][key]
  }

  set<K extends keyof T = keyof T>(key: K, value: T[K]) {
    this.changed = true
    this[kObj][key] = value
  }

  delete() {
    this.changed = true
    this.deleted = true
  }

  options(opts: FastifyCookieOptions) {
    this[kCookieOptions] = opts
  }
}
