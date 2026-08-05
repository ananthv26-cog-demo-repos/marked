import type { MarkedExtension } from './MarkedOptions.ts';
import type { Tokens } from './Tokens.ts';

export interface FootnoteOptions {
  prefix?: string;
  backRefLabel?: string;
}

/**
 * Adds GFM-style footnote references and definitions.
 *
 * Use a separate `footnote()` call for each `Marked` instance.
 */
export function footnote(options: FootnoteOptions = {}): MarkedExtension {
  const prefix = options.prefix ?? 'footnote-';
  const backRefLabel = options.backRefLabel ?? '↩';
  const definitions = new Map<string, { token: Tokens.Generic, referenced: boolean }>();
  const references = new Map<string, { index: number, refCount: number, token: Tokens.Generic }>();
  let nextIndex = 1;

  const normalizeLabel = (label: string) => label.toLowerCase().replace(/\s+/g, ' ');
  const labelPattern = '[^\\[\\]\\n]+';
  const definitionPattern = new RegExp(`^\\[\\^(${labelPattern})\\]:`);
  const referencePattern = new RegExp(`^\\[\\^(${labelPattern})\\]`);

  return {
    extensions: [
      {
        name: 'footnoteDefinition',
        level: 'block',
        start(src) {
          const match = /\n\[\^/.exec(src);
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
          const consumed = [lines[0]];
          let lineIndex = 1;
          while (lineIndex < lines.length) {
            const line = lines[lineIndex];
            const isBlank = line.trim() === '';
            const isIndented = /^(?: {4}|\t)/.test(line);
            const isDefinition = /^\[\^[^\[\]\n]+]:/.test(line);

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
          const token: Tokens.Generic = {
            type: 'footnoteDefinition',
            raw,
            label,
            tokens: this.lexer.blockTokens(contentLines.join('\n')),
          };
          if (!definitions.has(key)) {
            definitions.set(key, { token, referenced: false });
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
        tokenizer(src) {
          const match = referencePattern.exec(src);
          if (!match || /(^\s|\s$)/.test(match[1])) {
            return undefined;
          }
          const key = normalizeLabel(match[1]);
          const definition = definitions.get(key);
          if (!definition) {
            return undefined;
          }
          let reference = references.get(key);
          if (!reference) {
            reference = {
              index: nextIndex++,
              refCount: 0,
              token: definition.token,
            };
            references.set(key, reference);
          }
          reference.refCount++;
          definition.referenced = true;
          return {
            type: 'footnoteRef',
            raw: match[0],
            label: match[1],
            index: reference.index,
            refIndex: reference.refCount,
          };
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
          let output = '<section class="footnotes" data-footnotes>\n<ol>\n';
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
        definitions.clear();
        references.clear();
        nextIndex = 1;
        return markdown;
      },
      processAllTokens(tokens) {
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
