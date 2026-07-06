/**
 * responseSanitizer.ts
 *
 * Strips internal LLM reasoning tags from model output.
 *
 * Tags handled (case-insensitive, including typo variant):
 *   <thought>  <though>  <think>  <thinking>  <reasoning>
 *   and their respective closing variants.
 *
 * Rules:
 * 1. Content INSIDE tags  → thinkingContent  (reasoning trace)
 * 2. Content OUTSIDE tags → finalContent     (shown to user)
 * 3. Streaming: buffer partial/incomplete tags so they never leak to output
 * 4. Code blocks (``` … ```) are treated as opaque — tags inside are NOT stripped
 * 5. Unclosed tag: content after opening tag counts as thinkingContent
 * 6. Normal markdown, HTML entities, and user HTML are left completely intact
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * All recognised tag names (order matters — longer names before shorter
 * prefixes so that the prefix-detection regex stays unambiguous).
 */
const TAG_NAMES = ['thinking', 'reasoning', 'thought', 'though', 'think'] as const
type TagName = (typeof TAG_NAMES)[number]

/**
 * Regex that matches a complete opening or closing tag for any of the
 * recognised names (case-insensitive).
 *
 * Capture groups:
 *   [1] full match
 *   [2] tag name
 */
const COMPLETE_TAG_RE = /(<\/?(thinking|reasoning|thought|though|think)\s*>)/gi

/**
 * Maximum length of a partial tag that we need to buffer during streaming.
 * e.g. '</thinking>' is 11 chars; add a few for whitespace safety.
 */
const MAX_PARTIAL_TAG_LEN = 14

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when `name` is one of the recognised tag names */
function isKnownTag(name: string): name is TagName {
  return (TAG_NAMES as readonly string[]).includes(name.toLowerCase())
}

// ---------------------------------------------------------------------------
// Code-block span extraction
// ---------------------------------------------------------------------------

/**
 * Returns an array of [start, end) index pairs for every fenced code block
 * (``` ... ```) present in `text`.  Content inside these spans is considered
 * opaque and must not be altered.
 */
function getCodeBlockSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  const fence = /```[^\n]*\n[\s\S]*?```/g
  let m: RegExpExecArray | null
  while ((m = fence.exec(text)) !== null) {
    spans.push([m.index, m.index + m[0].length])
  }
  return spans
}

/** Returns true when position `idx` falls inside any of the code-block spans */
function inCodeBlock(idx: number, spans: Array<[number, number]>): boolean {
  for (const [s, e] of spans) {
    if (idx >= s && idx < e) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SanitizeResult {
  /** Clean text with all internal reasoning tags and their content removed */
  finalContent: string
  /** Text that was inside the reasoning tags (may be empty) */
  thinkingContent: string
  /** True if any reasoning tags were found and stripped */
  hadInternalTags: boolean
}

// ---------------------------------------------------------------------------
// sanitizeResponse — complete-string version
// ---------------------------------------------------------------------------

/**
 * Processes a complete (non-streaming) response string.
 *
 * - Extracts content inside `<thought>...</thought>` (and variants) into
 *   `thinkingContent`.
 * - Returns `finalContent` with no internal tags or their contents.
 * - Content inside fenced code blocks is left untouched.
 */
export function sanitizeResponse(raw: string): SanitizeResult {
  const codeSpans = getCodeBlockSpans(raw)

  let finalContent = ''
  let thinkingContent = ''
  let hadInternalTags = false

  let pos = 0
  let depth = 0
  let openTagName: string | null = null

  COMPLETE_TAG_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = COMPLETE_TAG_RE.exec(raw)) !== null) {
    const matchStart = match.index
    const matchEnd = matchStart + match[0].length
    const isClosing = match[0][1] === '/'
    const tagName = match[2].toLowerCase()

    // Skip tags inside code blocks
    if (inCodeBlock(matchStart, codeSpans)) {
      continue
    }

    if (!isClosing) {
      // Opening tag
      if (depth === 0) {
        finalContent += raw.slice(pos, matchStart)
        hadInternalTags = true
        openTagName = tagName
        depth = 1
        pos = matchEnd
      } else {
        if (tagName === openTagName) depth++
        thinkingContent += raw.slice(pos, matchStart)
        pos = matchEnd
      }
    } else {
      // Closing tag
      if (depth > 0 && isKnownTag(tagName)) {
        thinkingContent += raw.slice(pos, matchStart)
        if (tagName === openTagName) {
          depth = Math.max(0, depth - 1)
          if (depth === 0) {
            openTagName = null
          }
        }
        pos = matchEnd
      }
      // Stray closing tag outside any open — leave as-is (handled by pos not advancing)
    }
  }

  // Remainder after last match
  if (depth > 0) {
    // Unclosed tag: rest goes to thinkingContent
    thinkingContent += raw.slice(pos)
  } else {
    finalContent += raw.slice(pos)
  }

  return {
    finalContent: finalContent.trimStart(),
    thinkingContent: thinkingContent.trim(),
    hadInternalTags,
  }
}

// ---------------------------------------------------------------------------
// StreamingSanitizer — chunk-by-chunk version
// ---------------------------------------------------------------------------

/**
 * Maintains state across streaming chunks so that:
 * - Partial tags that arrive split across multiple chunks are buffered and
 *   never leak to the safe output.
 * - Complete tags (and their contents) are properly classified.
 *
 * Usage:
 * ```ts
 * const sanitizer = new StreamingSanitizer()
 * for (const token of streamTokens) {
 *   sanitizer.appendChunk(token)
 *   ui.setContent(sanitizer.getSafeOutput())
 *   ui.setThinking(sanitizer.getThinkingBuffer())
 * }
 * const result = sanitizer.finalize()
 * ```
 */
export class StreamingSanitizer {
  private _rawAccum: string = ''
  private _processedUpTo: number = 0
  private _safeOutput: string = ''
  private _thinkingBuffer: string = ''
  private _inThinking: boolean = false
  private _openTagName: string | null = null
  private _depth: number = 0
  private _hadTags: boolean = false
  private _inCodeBlock: boolean = false
  private _pendingBackticks: number = 0

  constructor() {}

  /** Append a new streaming chunk and update internal state. */
  appendChunk(chunk: string): void {
    this._rawAccum += chunk
    this._process()
  }

  /**
   * Returns the text that is safe to display to the user at this point.
   * Trimmed of leading whitespace.
   */
  getSafeOutput(): string {
    return this._safeOutput.trimStart()
  }

  /** Returns the accumulated reasoning/thinking text so far. */
  getThinkingBuffer(): string {
    return this._thinkingBuffer
  }

  /**
   * Call when the stream is complete. Processes any remaining buffered
   * content and returns the final SanitizeResult.
   */
  finalize(): SanitizeResult {
    this._flush()
    return {
      finalContent: this._safeOutput.trimStart(),
      thinkingContent: this._thinkingBuffer.trim(),
      hadInternalTags: this._hadTags,
    }
  }

  // -------------------------------------------------------------------------
  // Internal processing
  // -------------------------------------------------------------------------

  private _emit(text: string): void {
    if (this._inThinking) {
      this._thinkingBuffer += text
    } else {
      this._safeOutput += text
    }
  }

  private _flushPendingBackticks(): void {
    if (this._pendingBackticks > 0) {
      this._emit('`'.repeat(this._pendingBackticks))
      this._pendingBackticks = 0
    }
  }

  private _process(): void {
    const raw = this._rawAccum
    let i = this._processedUpTo

    while (i < raw.length) {
      const ch = raw[i]

      // ------------------------------------------------------------------
      // Backtick / code-fence detection
      // ------------------------------------------------------------------
      if (ch === '`') {
        this._pendingBackticks++
        i++

        if (this._pendingBackticks === 3) {
          this._emit('```')
          this._pendingBackticks = 0
          this._inCodeBlock = !this._inCodeBlock
          this._processedUpTo = i
        }
        continue
      }

      // Flush pending backticks if no longer accumulating
      if (this._pendingBackticks > 0) {
        this._flushPendingBackticks()
        this._processedUpTo = i
      }

      // ------------------------------------------------------------------
      // Inside a code block: pass everything through verbatim as safe text
      // ------------------------------------------------------------------
      if (this._inCodeBlock) {
        this._safeOutput += ch
        i++
        this._processedUpTo = i
        continue
      }

      // ------------------------------------------------------------------
      // Potential tag start '<'
      // ------------------------------------------------------------------
      if (ch === '<') {
        const remaining = raw.slice(i)

        // Check for a complete known tag
        const tagMatch = /^(<\/?(thinking|reasoning|thought|though|think)\s*>)/i.exec(remaining)
        if (tagMatch) {
          const fullTag = tagMatch[0]
          const isClosing = fullTag[1] === '/'
          const tagName = (tagMatch[2] ?? '').toLowerCase()
          const tagEnd = i + fullTag.length

          this._hadTags = true

          if (!isClosing) {
            if (this._depth === 0) {
              this._inThinking = true
              this._openTagName = tagName
              this._depth = 1
            } else {
              if (tagName === this._openTagName) this._depth++
              // Tag markup consumed; content between chunks already went to _emit
            }
          } else {
            if (this._depth > 0 && isKnownTag(tagName)) {
              if (tagName === this._openTagName) {
                this._depth = Math.max(0, this._depth - 1)
                if (this._depth === 0) {
                  this._inThinking = false
                  this._openTagName = null
                }
              }
            } else {
              // Stray closing tag — emit as-is
              this._emit(fullTag)
            }
          }

          i = tagEnd
          this._processedUpTo = i
          continue
        }

        // Not a complete known tag — check if it could be a partial one
        if (this._couldBePartialTag(remaining)) {
          // Stop here and wait for more data
          break
        }

        // Some other '<' — emit immediately
        this._emit(ch)
        i++
        this._processedUpTo = i
        continue
      }

      // ------------------------------------------------------------------
      // Regular character
      // ------------------------------------------------------------------
      this._emit(ch)
      i++
      this._processedUpTo = i
    }
  }

  private _flush(): void {
    this._flushPendingBackticks()

    const raw = this._rawAccum
    const remaining = raw.slice(this._processedUpTo)

    if (remaining.length === 0) return

    if (this._inThinking) {
      // Inside an unclosed tag — all remaining text is thinking content
      this._thinkingBuffer += remaining
    } else {
      // Outside any tag — run the full sanitizer on the tail
      const tailResult = sanitizeResponse(remaining)
      this._safeOutput += tailResult.finalContent.trimStart()
      this._thinkingBuffer += tailResult.thinkingContent
      if (tailResult.hadInternalTags) this._hadTags = true
    }

    this._processedUpTo = raw.length
  }

  private _couldBePartialTag(text: string): boolean {
    const prefixes: string[] = []
    for (const name of TAG_NAMES) {
      for (let len = 1; len <= name.length; len++) {
        prefixes.push(name.slice(0, len))
      }
    }
    const uniquePrefixes = Array.from(new Set(prefixes))
    const prefixPattern = new RegExp(
      `^<\\/?(?:${uniquePrefixes.join('|')})?$`,
      'i'
    )

    const clean = text.split('>')[0]
    return prefixPattern.test(clean)
  }
}
