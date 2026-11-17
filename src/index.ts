/**
 * Deterministic subword and special-token tokenizer.
 * @description Maps subword chunks via bijective base-256 and special tokens.
 */
export default class ByteTokenizer {
  /** Bijective base for chunk IDs */
  static readonly #base = 256
  /** Highest chunk ID, special tokens start after this */
  static readonly #chunkLimit = ByteTokenizer.#base * ByteTokenizer.#base + ByteTokenizer.#base
  /** UTF-8 decoder that keeps a leading BOM */
  static readonly #decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
  /** UTF-8 encoder for text and special tokens */
  static readonly #encoder = new TextEncoder()
  /** UTF-8 bytes packed per chunk ID */
  static readonly #maxBytes = 2
  /** Case-aware subword pattern covering all text */
  static readonly #pattern = [
    '\\p{N}{1,3}',
    '[一-龥぀-ゟ゠-ヿ]+',
    "[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]*[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]+(?i:'s|'t|'re|'ve|'m|'ll|'d)?",
    "[^\\r\\n\\p{L}\\p{N}]?[\\p{Lu}\\p{Lt}\\p{Lm}\\p{Lo}\\p{M}]+[\\p{Ll}\\p{Lm}\\p{Lo}\\p{M}]*(?i:'s|'t|'re|'ve|'m|'ll|'d)?",
    ' ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*',
    '\\s*[\\r\\n]+',
    '\\s+(?!\\S)',
    '\\s+'
  ].join('|')
  /** Subword matcher for plain text slices */
  static readonly #regex = new RegExp(ByteTokenizer.#pattern, 'gu')
  /** Special tokens sorted longest first */
  #token: string[]
  /** Special-token bytes keyed by token ID */
  #tokenBytes: Map<number, Uint8Array>
  /** Special-token text keyed by token ID */
  #tokenIds: Map<string, number>

  /**
   * Build tokenizer from special tokens.
   * @description Assigns IDs after the chunk range and ignores duplicates.
   * @param specialToken - Special token strings
   * @throws TypeError when the argument or a token is invalid
   */
  constructor(specialToken: string[] = []) {
    if (!Array.isArray(specialToken)) {
      throw new TypeError('Special token must be an array of strings')
    }
    this.#token = []
    this.#tokenIds = new Map<string, number>()
    this.#tokenBytes = new Map<number, Uint8Array>()
    for (let index = 0; index < specialToken.length; index++) {
      const token = specialToken[index]
      if (typeof token !== 'string' || token.length === 0) {
        throw new TypeError('Each special token must be a non-empty string')
      }
      if (this.#tokenIds.has(token)) {
        continue
      }
      const identifier = ByteTokenizer.#chunkLimit + 1 + this.#tokenIds.size
      this.#token.push(token)
      this.#tokenIds.set(token, identifier)
      this.#tokenBytes.set(identifier, ByteTokenizer.#encoder.encode(token))
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
    const limit = ByteTokenizer.#chunkLimit + 1 + this.#tokenBytes.size
    for (let index = 0; index < identifier.length; index++) {
      const value = identifier[index]
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new TypeError(`Token ID at index ${index} must be an integer`)
      }
      if (value < 1 || Object.is(value, -0) || value >= limit) {
        throw new RangeError(
          `Token ID ${value} at index ${index} is out of range [1, ${limit - 1}]`
        )
      }
    }
    const bytes: number[] = []
    for (let index = 0; index < identifier.length; index++) {
      const value = identifier[index] as number
      const token = this.#tokenBytes.get(value)
      if (token !== undefined) {
        bytes.push(...token)
        continue
      }
      const chunk: number[] = []
      let remainder = value
      while (remainder > 0) {
        let digit = remainder % ByteTokenizer.#base
        if (digit === 0) {
          digit = ByteTokenizer.#base
        }
        chunk.unshift(digit - 1)
        remainder = (remainder - digit) / ByteTokenizer.#base
      }
      bytes.push(...chunk)
    }
    return ByteTokenizer.#decoder.decode(Uint8Array.from(bytes))
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
    if (/\p{Surrogate}/u.test(text)) {
      throw new TypeError('Text contains an unpaired surrogate')
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
        identifier.push(this.#tokenIds.get(matched) as number)
        cursor += matched.length
        continue
      }
      let boundary = text.length
      for (let index = 0; index < this.#token.length; index++) {
        const token = this.#token[index]
        if (token === undefined) {
          continue
        }
        const found = text.indexOf(token, cursor + 1)
        if (found !== -1 && found < boundary) {
          boundary = found
        }
      }
      const slice = text.slice(cursor, boundary)
      let offset = 0
      ByteTokenizer.#regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = ByteTokenizer.#regex.exec(slice)) !== null) {
        if (match.index !== offset) {
          throw new RangeError(`Pattern left text uncovered at ${offset}`)
        }
        const bytes = ByteTokenizer.#encoder.encode(match[0])
        for (let start = 0; start < bytes.length; start += ByteTokenizer.#maxBytes) {
          let chunkId = 0
          for (const byte of bytes.subarray(start, start + ByteTokenizer.#maxBytes)) {
            chunkId = chunkId * ByteTokenizer.#base + byte + 1
          }
          identifier.push(chunkId)
        }
        offset += match[0].length
      }
      if (offset !== slice.length) {
        throw new RangeError(`Pattern left text uncovered at ${offset}`)
      }
      cursor = boundary
    }
    return identifier
  }
}
