/**
 * Byte and special-token tokenizer.
 * @description Maps UTF-8 bytes and configured special tokens.
 */
export default class ByteTokenizer {
  /** UTF-8 decoder that keeps a leading BOM */
  static readonly #decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
  /** UTF-8 encoder for text and special tokens */
  static readonly #encoder = new TextEncoder()
  /** Special-token bytes keyed by token ID */
  #idToToken: Map<number, Uint8Array>
  /** Special-token text keyed by token ID */
  #tokenToId: Map<string, number>
  /** Special tokens sorted longest first */
  #token: string[]

  /**
   * Build tokenizer from special tokens.
   * @description Assigns IDs from 256 and ignores duplicates.
   * @param specialToken - Special token strings
   * @throws TypeError when the argument or a token is invalid
   */
  constructor(specialToken: string[] = []) {
    if (!Array.isArray(specialToken)) {
      throw new TypeError('Special token must be an array of strings')
    }
    this.#token = []
    this.#tokenToId = new Map<string, number>()
    this.#idToToken = new Map<number, Uint8Array>()
    for (let index = 0; index < specialToken.length; index++) {
      const token = specialToken[index]
      if (typeof token !== 'string' || token.length === 0) {
        throw new TypeError('Each special token must be a non-empty string')
      }
      if (this.#tokenToId.has(token)) {
        continue
      }
      const identifier = 256 + this.#tokenToId.size
      this.#token.push(token)
      this.#tokenToId.set(token, identifier)
      this.#idToToken.set(identifier, ByteTokenizer.#encoder.encode(token))
    }
    this.#token.sort((left, right) => right.length - left.length)
  }

  /**
   * Decode token IDs into text.
   * @description Rebuilds UTF-8 bytes and special-token text.
   * @param identifier - Token IDs to decode
   * @returns Decoded UTF-8 text
   * @throws TypeError when an ID is not an integer
   * @throws RangeError when an ID is outside the vocabulary
   */
  decode(identifier: ArrayLike<number>): string {
    if (
      typeof identifier !== 'object' ||
      identifier === null ||
      typeof identifier.length !== 'number'
    ) {
      throw new TypeError('Identifier must be an array-like object of integers')
    }
    const limit = 256 + this.#idToToken.size
    let total = 0
    for (let index = 0; index < identifier.length; index++) {
      const value = identifier[index]
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new TypeError(`Token ID at index ${index} must be an integer`)
      }
      if (value < 0 || Object.is(value, -0) || value >= limit) {
        throw new RangeError(
          `Token ID ${value} at index ${index} is out of range [0, ${limit - 1}]`
        )
      }
      const token = this.#idToToken.get(value)
      total += token !== undefined ? token.length : 1
    }
    const buffer = new Uint8Array(total)
    let offset = 0
    for (let index = 0; index < identifier.length; index++) {
      const value = identifier[index] as number
      const token = this.#idToToken.get(value)
      if (token !== undefined) {
        buffer.set(token, offset)
        offset += token.length
      } else {
        buffer[offset++] = value
      }
    }
    return ByteTokenizer.#decoder.decode(buffer)
  }

  /**
   * Encode text into token IDs.
   * @description Prefers the longest matching special token.
   * @param text - Text to encode
   * @returns Token IDs for the text
   * @throws TypeError when text is not a string
   */
  encode(text: string): number[] {
    if (typeof text !== 'string') {
      throw new TypeError('Text must be a string')
    }
    if (this.#token.length === 0) {
      return Array.from(ByteTokenizer.#encoder.encode(text))
    }
    const identifier: number[] = []
    let cursor = 0
    while (cursor < text.length) {
      let matched: string | undefined
      for (let index = 0; index < this.#token.length; index++) {
        const token = this.#token[index]
        if (token !== undefined && text.startsWith(token, cursor)) {
          matched = token
          break
        }
      }
      if (matched !== undefined) {
        identifier.push(this.#tokenToId.get(matched) as number)
        cursor += matched.length
        continue
      }
      const next = this.#next(text, cursor)
      const bytes = ByteTokenizer.#encoder.encode(text.slice(cursor, next))
      for (let index = 0; index < bytes.length; index++) {
        const value = bytes[index]
        if (value !== undefined) {
          identifier.push(value)
        }
      }
      cursor = next
    }
    return identifier
  }

  /**
   * Find the next special token.
   * @description Searches after the current cursor position.
   * @param text - Text being encoded
   * @param cursor - Current character offset
   * @returns Offset of the next token or text end
   */
  #next(text: string, cursor: number): number {
    let next = text.length
    for (let index = 0; index < this.#token.length; index++) {
      const token = this.#token[index]
      if (token === undefined) {
        continue
      }
      const found = text.indexOf(token, cursor + 1)
      if (found !== -1 && found < next) {
        next = found
      }
    }
    return next
  }
}
