import type { MarkedExtension } from './MarkedOptions.ts';
import type { Token, Tokens, TokensList } from './Tokens.ts';

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
  definitions: Map<string, { token: Tokens.Generic }>;
  references: {
    token: Tokens.Generic;
    label: string;
    context?: string;
    sequence: number;
  }[];
  tokenContexts: Map<Token[], string | undefined>;
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
  const definitionPattern = new RegExp(`^ {0,3}\\[\\^(${labelPattern})\\]:`);
  const referencePattern = new RegExp(`^\\[\\^(${labelPattern})\\]`);
  const definitionStartPattern = new RegExp(`(?:^|\\n) {0,3}\\[\\^${labelPattern}\\]:`);

  const getState = (tokens: TokensList) => {
    let state = states.get(tokens);
    if (!state) {
      state = {
        definitions: new Map(),
        references: [],
        tokenContexts: new Map(),
        sequence: 0,
      };
      states.set(tokens, state);
    }
    return state;
  };

  const registerTokenArrays = (tokens: Token[], context: string, state: FootnoteState) => {
    if (!state.tokenContexts.has(tokens)) {
      state.tokenContexts.set(tokens, context);
    }
    for (const token of tokens) {
      const generic = token as Tokens.Generic;
      if (generic.tokens) {
        registerTokenArrays(generic.tokens, state.tokenContexts.get(generic.tokens) ?? context, state);
      }
      if (generic.type === 'list') {
        registerTokenArrays(generic.items, state.tokenContexts.get(generic.items) ?? context, state);
      }
      if (generic.type === 'table') {
        const table = generic as Tokens.Table;
        for (const cell of table.header) {
          registerTokenArrays(cell.tokens, context, state);
        }
        for (const row of table.rows) {
          for (const cell of row) {
            registerTokenArrays(cell.tokens, context, state);
          }
        }
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
          return match.index + (match[0][0] === '\n' ? 1 : 0);
        },
        tokenizer(src) {
          const match = definitionPattern.exec(src);
          if (!match || /(^\s|\s$)/.test(match[1])) {
            return undefined;
          }

          const lines = src.split('\n');
          const consumed = [lines[0]];
          let lineIndex = 1;
          while (lineIndex < lines.length) {
            const line = lines[lineIndex];
            const isBlank = line.trim() === '';
            const isIndented = /^(?: {4}|\t)/.test(line);
            const isDefinition = /^ {0,3}\[\^[^\[\]\n]+]:/.test(line);

            if (isBlank) {
              const next = lines[lineIndex + 1];
              if (next === undefined || !/^(?: {4}|\t)/.test(next)) {
                break;
              }
              consumed.push(line);
              lineIndex++;
              continue;
            }
            if (isDefinition && !isIndented) {
              break;
            }
            if (!isIndented && isBlockConstruct(line)) {
              break;
            }
            if (isIndented) {
              consumed.push(line.replace(/^(?: {4}|\t)/, ''));
            } else {
              consumed.push(line);
            }
            lineIndex++;
          }

          const raw = consumed.join('\n');
          const contentLines = consumed.slice();
          contentLines[0] = contentLines[0].slice(match[0].length).replace(/^ ?/, '');
          const label = match[1];
          const key = normalizeLabel(label);
          const state = getState(this.lexer.tokens);
          const definitionTokens = this.lexer.blockTokens(contentLines.join('\n'));
          const token: Tokens.Generic = {
            type: 'footnoteDefinition',
            raw,
            label,
            tokens: definitionTokens,
          };
          if (!state.definitions.has(key)) {
            state.definitions.set(key, { token });
          }
          registerTokenArrays(definitionTokens, key, state);
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
          };
          state.references.push({
            token,
            label: key,
            context: state.tokenContexts.get(tokens),
            sequence: state.sequence++,
          });
          return token;
        },
      },
      {
        name: 'footnoteRef',
        renderer(token) {
          const suffix = token.refIndex > 1 ? `-${token.refIndex}` : '';
          return `<sup><a href="#${prefix}${token.index}" id="${prefix}ref-${token.index}${suffix}" data-footnote-ref aria-describedby="footnote-label">${token.index}</a></sup>`;
        },
      },
      {
        name: 'footnotes',
        renderer(token) {
          let output = `<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">${headingLabel}</h2>\n<ol>\n`;
          for (const item of token.items) {
            let content = this.parser.parse(item.tokens);
            const backrefs = Array.from({ length: item.refCount }, (_, i) => {
              const refIndex = i + 1;
              const suffix = refIndex > 1 ? `-${refIndex}` : '';
              const label = `${item.index}${suffix}`;
              return `<a href="#${prefix}ref-${label}" data-footnote-backref aria-label="Back to reference ${label}">${backRefLabel}${refIndex > 1 ? `<sup>${refIndex}</sup>` : ''}</a>`;
            }).join(' ');
            if (content.endsWith('</p>\n')) {
              content = content.slice(0, -5) + backrefs + '</p>\n';
            } else {
              content += `<p>${backrefs}</p>\n`;
            }
            output += `<li id="${prefix}${item.index}">\n${content}</li>\n`;
          }
          return output + '</ol>\n</section>\n';
        },
      },
    ],
    hooks: {
      preprocess(markdown) {
        return markdown;
      },
      emStrongMask(src) {
        return src.replace(/\[\^[^\[\]\n]+\]/g, match => 'a'.repeat(match.length));
      },
      processAllTokens(tokens) {
        if (this.block === false) {
          return tokens;
        }
        const state = getState(tokens as TokensList);
        const reachable = new Set<string>();
        const pending = state.references
          .filter(reference => reference.context === undefined)
          .map(reference => reference.label);
        while (pending.length > 0) {
          const key = pending.shift()!;
          if (reachable.has(key) || !state.definitions.has(key)) {
            continue;
          }
          reachable.add(key);
          state.references.forEach(reference => {
            if (reference.context === key) {
              pending.push(reference.label);
            }
          });
        }
        const ordered: FootnoteState['references'] = [];
        const included = new Set<string>();
        const visitedDefinitions = new Set<string>();
        const documentReferences = state.references
          .filter(reference => reference.context === undefined && reachable.has(reference.label))
          .sort((a, b) => a.sequence - b.sequence);
        ordered.push(...documentReferences);
        documentReferences.forEach(reference => included.add(reference.label));
        const visitDefinition = (key: string) => {
          if (visitedDefinitions.has(key)) {
            return;
          }
          visitedDefinitions.add(key);
          for (const reference of state.references
            .filter(reference => reference.context === key && reachable.has(reference.label))
            .sort((a, b) => a.sequence - b.sequence)) {
            ordered.push(reference);
            if (!included.has(reference.label)) {
              included.add(reference.label);
              visitDefinition(reference.label);
            }
          }
        };
        for (const key of new Set(documentReferences.map(reference => reference.label))) {
          visitDefinition(key);
        }
        const references = new Map<string, { index: number, refCount: number, token: Tokens.Generic }>();
        let nextIndex = 1;
        for (const reference of ordered) {
          let item = references.get(reference.label);
          if (!item) {
            item = {
              index: nextIndex++,
              refCount: 0,
              token: state.definitions.get(reference.label)!.token,
            };
            references.set(reference.label, item);
          }
          item.refCount++;
          reference.token.index = item.index;
          reference.token.refIndex = item.refCount;
        }
        if (references.size > 0) {
          // Definition tokens are already walked in place; childTokens would visit them twice.
          const items = Array.from(references.values())
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
