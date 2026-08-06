import type { MarkedExtension } from './MarkedOptions.ts';
import type { Tokens, TokensList } from './Tokens.ts';
import { escapeHtmlEntities as escape } from './helpers.ts';

export interface FootnoteOptions {
  prefix?: string;
  backRefLabel?: string;
  label?: string;
}

const blockHtmlTags = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|ol|p|pre|script|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const blockStartPattern = new RegExp(`^ {0,3}(?:#{1,6}(?:[ \\t]|$)|(?:\`\`\`|~~~)|>[ \\t]?|(?:[*+-]|\\d+[.)])[ \\t]+|<!--|</?(?:${blockHtmlTags})(?:[ \\t/>]|$))`);

function isThematicBreak(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 3) {
    return false;
  }
  const marker = trimmed[0];
  if (marker !== '*' && marker !== '-' && marker !== '_') {
    return false;
  }
  let count = 0;
  for (const character of trimmed) {
    if (character === marker) {
      count++;
    } else if (character !== ' ' && character !== '\t') {
      return false;
    }
  }
  return count >= 3;
}

function isBlockConstruct(line: string) {
  return blockStartPattern.test(line) || isThematicBreak(line);
}

interface FootnoteState {
  definitions: Set<string>;
  sequence: number;
}

/**
 * Adds GFM-style footnote references and definitions.
 *
 * Use a separate `footnote()` call for each `Marked` instance.
 */
export function footnote(options: FootnoteOptions = {}): MarkedExtension {
  const prefix = options.prefix ?? 'footnote-';
  const backRefLabel = options.backRefLabel ?? '↩';
  const headingLabel = options.label ?? 'Footnotes';
  const states = new WeakMap<TokensList, FootnoteState>();

  const normalizeLabel = (label: string) => label.toLowerCase().replace(/\s+/g, ' ');
  const labelPattern = '[^\\[\\]\\n]+';
  const definitionPattern = new RegExp(`^ {0,3}\\[\\^(${labelPattern})\\]:(?=[ \\t]|\\n|$)`);
  const referencePattern = new RegExp(`^\\[\\^(${labelPattern})\\]`);
  const definitionStartPattern = new RegExp(`\\n {0,3}\\[\\^${labelPattern}\\]:(?=[ \\t]|\\n|$)`);

  const getState = (tokens: TokensList) => {
    let state = states.get(tokens);
    if (!state) {
      state = {
        definitions: new Set(),
        sequence: 0,
      };
      states.set(tokens, state);
    }
    return state;
  };

  const collectFootnoteRefs = (
    tokens: TokensList | Tokens.Generic[] | Tokens.TableCell[] | Tokens.ListItem[],
    stack: Tokens.Generic[],
    refs: { token: Tokens.Generic; context?: Tokens.Generic; key: string; sequence: number }[],
    definitions: Map<string, Tokens.Generic>,
    inLink = false,
  ) => {
    for (const token of tokens as Tokens.Generic[]) {
      if (token.type === 'footnoteDefinition') {
        const key = normalizeLabel(token.label);
        if (!definitions.has(key)) {
          definitions.set(key, token);
        }
        stack.push(token);
        if (token.tokens) {
          collectFootnoteRefs(token.tokens as TokensList, stack, refs, definitions, inLink);
        }
        stack.pop();
        continue;
      }
      if (token.type === 'footnoteRef' && !inLink) {
        const sequence = (token as Tokens.Generic & { sequence?: number }).sequence ?? 0;
        refs.push({ token, context: stack.at(-1), key: normalizeLabel(token.label), sequence });
      }
      if (token.type === 'list') {
        for (const item of token.items) {
          collectFootnoteRefs(item.tokens, stack, refs, definitions, inLink);
        }
        continue;
      }
      if (token.type === 'table') {
        for (const cell of token.header) {
          collectFootnoteRefs(cell.tokens, stack, refs, definitions, inLink);
        }
        for (const row of token.rows) {
          for (const cell of row) {
            collectFootnoteRefs(cell.tokens, stack, refs, definitions, inLink);
          }
        }
        continue;
      }
      // Keep refs out of links/images: outputLink resets inLink after nested content.
      if (token.type === 'link' || token.type === 'image') {
        if (token.tokens) {
          collectFootnoteRefs(token.tokens as TokensList, stack, refs, definitions, true);
        }
        continue;
      }
      if (token.tokens) {
        collectFootnoteRefs(token.tokens as TokensList, stack, refs, definitions, inLink);
      }
    }
  };

  return {
    extensions: [
      {
        name: 'footnoteDefinition',
        level: 'block',
        start(src) {
          const match = definitionStartPattern.exec(src);
          if (!match) {
            return undefined;
          }
          return match.index + 1;
        },
        tokenizer(src) {
          const match = definitionPattern.exec(src);
          if (!match || /(^\s|\s$)/.test(match[1])) {
            return undefined;
          }

          const lines = src.split('\n');
          const rawLines = [lines[0]];
          const contentLines = [lines[0]];
          let lineIndex = 1;
          while (lineIndex < lines.length) {
            const line = lines[lineIndex];
            const isBlank = line.trim() === '';
            const isIndented = /^(?: {4}|\t)/.test(line);
            const isDefinition = /^ {0,3}\[\^[^\[\]\n]+]:(?=[ \t]|$)/.test(line);

            if (isBlank) {
              let nextIndex = lineIndex + 1;
              while (nextIndex < lines.length && lines[nextIndex].trim() === '') {
                nextIndex++;
              }
              if (nextIndex === lines.length || !/^(?: {4}|\t)/.test(lines[nextIndex])) {
                break;
              }
              while (lineIndex < nextIndex) {
                rawLines.push(lines[lineIndex]);
                contentLines.push(lines[lineIndex]);
                lineIndex++;
              }
              continue;
            }
            if (isDefinition && !isIndented) {
              break;
            }
            if (!isIndented && isBlockConstruct(line)) {
              break;
            }
            if (isIndented) {
              rawLines.push(line);
              contentLines.push(line.replace(/^(?: {4}|\t)/, ''));
            } else {
              rawLines.push(line);
              contentLines.push(line);
            }
            lineIndex++;
          }

          const raw = rawLines.join('\n');
          contentLines[0] = contentLines[0].slice(match[0].length).replace(/^[ \t]+/, '');
          const label = match[1];
          const key = normalizeLabel(label);
          const state = getState(this.lexer.tokens);
          const top = this.lexer.state.top;
          this.lexer.state.top = true;
          let definitionTokens!: TokensList;
          try {
            definitionTokens = this.lexer.blockTokens(contentLines.join('\n')) as TokensList;
          } finally {
            this.lexer.state.top = top;
          }
          const token: Tokens.Generic = {
            type: 'footnoteDefinition',
            raw,
            label,
            tokens: definitionTokens,
          };
          if (!state.definitions.has(key)) {
            state.definitions.add(key);
          }
          return token;
        },
        renderer() {
          return '';
        },
      },
      {
        name: 'footnoteRef',
        level: 'inline',
        start(src) {
          const index = src.indexOf('[^');
          return index >= 0 ? index : undefined;
        },
        tokenizer(src, tokens) {
          if (this.lexer.state.inLink) {
            return undefined;
          }
          const match = referencePattern.exec(src);
          if (!match || /(^\s|\s$)/.test(match[1])) {
            return undefined;
          }
          const key = normalizeLabel(match[1]);
          const state = getState(this.lexer.tokens);
          if (!state.definitions.has(key)) {
            return undefined;
          }
          const token: Tokens.Generic = {
            type: 'footnoteRef',
            raw: match[0],
            label: match[1],
            sequence: state.sequence++,
          };
          return token;
        },
      },
      {
        name: 'footnoteRef',
        renderer(token) {
          if (token.index === undefined) {
            return escape(token.raw);
          }
          const suffix = token.refIndex > 1 ? `-${token.refIndex}` : '';
          const idPrefix = escape(prefix, true);
          const labelId = `${idPrefix}label`;
          return `<sup><a href="#${idPrefix}${token.index}" id="${idPrefix}ref-${token.index}${suffix}" data-footnote-ref aria-describedby="${labelId}">${token.index}</a></sup>`;
        },
      },
      {
        name: 'footnotes',
        renderer(token) {
          const idPrefix = escape(prefix, true);
          const labelId = `${idPrefix}label`;
          let output = `<section class="footnotes" data-footnotes>\n<h2 id="${labelId}" class="sr-only">${escape(headingLabel)}</h2>\n<ol>\n`;
          for (const item of token.items) {
            let content = this.parser.parse(item.tokens);
            const backrefs = Array.from({ length: item.refCount }, (_, i) => {
              const refIndex = i + 1;
              const suffix = refIndex > 1 ? `-${refIndex}` : '';
              const label = `${item.index}${suffix}`;
              return `<a href="#${idPrefix}ref-${label}" data-footnote-backref aria-label="${escape(`Back to reference ${label}`)}">${escape(backRefLabel)}${refIndex > 1 ? `<sup>${refIndex}</sup>` : ''}</a>`;
            }).join(' ');
            if (content.endsWith('</p>\n')) {
              content = content.slice(0, -5) + backrefs + '</p>\n';
            } else {
              content += `<p>${backrefs}</p>\n`;
            }
            output += `<li id="${idPrefix}${item.index}">\n${content}</li>\n`;
          }
          return output + '</ol>\n</section>\n';
        },
      },
    ],
    hooks: {
      emStrongMask(src) {
        return src.replace(/\[\^[^\[\]\n]+\]/g, match => 'a'.repeat(match.length));
      },
      processAllTokens(tokens) {
        if (this.block === false) {
          return tokens;
        }
        const definitions = new Map<string, Tokens.Generic>();
        const collectedRefs: { token: Tokens.Generic; context?: Tokens.Generic; key: string; sequence: number }[] = [];
        collectFootnoteRefs(tokens as TokensList, [], collectedRefs, definitions);
        const reachable = new Set<Tokens.Generic>();
        const pending = collectedRefs
          .filter(reference => reference.context === undefined)
          .map(reference => reference.key);
        while (pending.length > 0) {
          const key = pending.shift()!;
          const definition = definitions.get(key);
          if (!definition || reachable.has(definition)) {
            continue;
          }
          reachable.add(definition);
          for (const reference of collectedRefs) {
            if (reference.context === definition) {
              pending.push(reference.key);
            }
          }
        }
        const ordered = collectedRefs
          .filter(reference => (reference.context === undefined || reachable.has(reference.context))
            && definitions.has(reference.key))
          .sort((a, b) => a.sequence - b.sequence);
        const footnotes = new Map<string, { index: number, refCount: number, token: Tokens.Generic }>();
        let nextIndex = 1;
        for (const reference of ordered) {
          const key = reference.key;
          let item = footnotes.get(key);
          if (!item) {
            item = {
              index: nextIndex++,
              refCount: 0,
              token: definitions.get(key)!,
            };
            footnotes.set(key, item);
          }
          item.refCount++;
          reference.token.index = item.index;
          reference.token.refIndex = item.refCount;
        }
        if (footnotes.size > 0) {
          // Definition tokens are already walked in place; childTokens would visit them twice.
          const items = Array.from(footnotes.values())
            .sort((a, b) => a.index - b.index)
            .map((reference) => ({
              ...reference.token,
              index: reference.index,
              refCount: reference.refCount,
            }));
          tokens.push({ type: 'footnotes', raw: '', items });
        }
        return tokens;
      },
    },
  };
}
