import sodium from 'sodium-native'

// Static salt to be used for key derivation, not great for security, but better than nothing
const DEFAULT_SALT = Buffer.from('mq9hDxBVDbspDR6nLfFT1g==', 'base64')

export const buildKeyFromSecretAndSalt = (secret: Buffer, salt: Buffer = DEFAULT_SALT): Buffer => {
  if (Buffer.byteLength(secret) < 32) {
    throw new Error('secret must be at least 32 bytes')
  }

  if (Buffer.byteLength(salt) !== sodium.crypto_pwhash_SALTBYTES) {
    throw new Error('salt must be length ' + sodium.crypto_pwhash_SALTBYTES)
  }

  const key = Buffer.allocUnsafe(sodium.crypto_secretbox_KEYBYTES)

  sodium.crypto_pwhash(
    key,
    secret,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
    sodium.crypto_pwhash_ALG_DEFAULT
  )

  return key
}
