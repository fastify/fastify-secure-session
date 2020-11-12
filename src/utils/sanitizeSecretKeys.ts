import { asBuffer } from '.'
import { SecretKey } from '../plugin'
import { crypto_secretbox_KEYBYTES } from 'sodium-native'

export const sanitizeSecretKeys = (key: SecretKey): Buffer[] => {
  let secretKeys: Buffer[] = Array.isArray(key) ? key.map((v) => asBuffer(v, 'base64')) : [asBuffer(key, 'base64')]
  if (secretKeys.some((key) => key.byteLength < crypto_secretbox_KEYBYTES)) {
    throw new Error(`key lengths must be at least ${crypto_secretbox_KEYBYTES} bytes`)
  }
  return secretKeys
}
