import type { MarkedExtension, TokenizerAndRendererExtension } from '../MarkedOptions.ts';
import type { _Lexer } from '../Lexer.ts';
import type { Token, Tokens } from '../Tokens.ts';
import { escapeHtmlEntities } from '../helpers.ts';

interface FootnoteDefinition {
  label: string;
  slug: string;
  tokens: Token[];
}

interface FootnoteReference {
  definition: FootnoteDefinition;
  number: number;
  count: number;
}

interface FootnoteState {
  definitions: Map<string, FootnoteDefinition>;
  references: Map<string, FootnoteReference>;
  order: FootnoteReference[];
  slugs: Set<string>;
}

interface FootnoteToken extends Tokens.Generic {
  type: 'footnote-end' | 'footnote-definition';
  state: FootnoteState;
}

export interface FootnoteOptions {
  /**
   * Prefix added to generated footnote and reference ids.
   */
  prefix?: string;
}

// A lexer is created for each parse, so this keeps async and sequential parses isolated.
const states = new WeakMap<_Lexer, FootnoteState>();

function getState(lexer: _Lexer): FootnoteState {
  const state = states.get(lexer);
  if (state) {
    return state;
  }
  const newState: FootnoteState = {
    definitions: new Map(),
    references: new Map(),
    order: [],
    slugs: new Set(),
  };
  states.set(lexer, newState);
  return newState;
}

function makeSlug(label: string, slugs: Set<string>) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'footnote';
  let slug = base;
  let suffix = 2;
  while (slugs.has(slug)) {
    slug = `${base}-${suffix++}`;
  }
  slugs.add(slug);
  return slug;
}

function definitionTokenizer(this: { lexer: _Lexer }, src: string): FootnoteToken | undefined {
  const firstLine = /^\[\^([^\]\s^]+)\]:[ \t]?(.*)(?:\n|$)/.exec(src);
  if (!firstLine) {
    return;
  }

  const lines = [firstLine[2]];
  let consumed = firstLine[0].length;
  let offset = consumed;
  while (offset < src.length) {
    const lineEnd = src.indexOf('\n', offset);
    const end = lineEnd === -1 ? src.length : lineEnd;
    const line = src.slice(offset, end);
    if (/^(?: {4}|\t)/.test(line)) {
      lines.push(line.startsWith('\t') ? line.slice(1) : line.slice(4));
      consumed = end + (lineEnd === -1 ? 0 : 1);
      offset = consumed;
      continue;
    }
    if (line.trim() === '') {
      const nextEnd = src.indexOf('\n', end + 1);
      const next = src.slice(end + 1, nextEnd === -1 ? src.length : nextEnd);
      if (/^(?: {4}|\t)/.test(next)) {
        lines.push('');
        consumed = end + (lineEnd === -1 ? 0 : 1);
        offset = consumed;
        continue;
      }
    }
    break;
  }

  const state = getState(this.lexer);
  const label = firstLine[1];
  const definition: FootnoteDefinition = {
    label,
    slug: makeSlug(label, state.slugs),
    tokens: this.lexer.blockTokens(lines.join('\n')) as Token[],
  };
  state.definitions.set(label, definition);

  return {
    type: 'footnote-definition',
    raw: src.slice(0, consumed),
    state,
  };
}

function referenceStart(src: string) {
  if (src.startsWith('[^')) {
    return undefined;
  }
  let index = src.indexOf('[^');
  while (index !== -1) {
    if (index > 0 && src[index - 1] !== '\\' && !src.slice(0, index).includes('\\')) {
      return index;
    }
    index = src.indexOf('[^', index + 2);
  }
  return undefined;
}

function referenceTokenizer(this: { lexer: _Lexer }, src: string): Tokens.Generic | undefined {
  if (src.startsWith('\\')) {
    return;
  }
  const match = /^\[\^([^\]\s^]+)\]/.exec(src);
  if (!match) {
    return;
  }
  const state = getState(this.lexer);
  const definition = state.definitions.get(match[1]);
  if (!definition) {
    return;
  }
  return {
    type: 'footnote-reference',
    raw: match[0],
    label: match[1],
    state,
  };
}

function backrefs(reference: FootnoteReference, prefix: string) {
  const links = [];
  for (let i = 1; i <= reference.count; i++) {
    const suffix = i === 1 ? '' : `-${i}`;
    links.push(`<a href="#${prefix}fnref-${reference.definition.slug}${suffix}" class="footnote-backref" data-footnote-backref aria-label="Back to reference ${reference.number}">↩</a>`);
  }
  return links.join(' ');
}

function appendBackrefs(html: string, links: string) {
  const end = html.lastIndexOf('</p>');
  if (end !== -1) {
    return `${html.slice(0, end)} ${links}${html.slice(end)}`;
  }
  return `<p>${html}${links}</p>`;
}

function findState(tokens: Token[]): FootnoteState | undefined {
  for (const token of tokens) {
    if (token.type === 'footnote-definition') {
      return (token as FootnoteToken).state;
    }
    const genericToken = token as Tokens.Generic;
    if (genericToken.tokens) {
      const state = findState(genericToken.tokens);
      if (state) {
        return state;
      }
    }
    if (token.type === 'list') {
      for (const item of token.items) {
        const state = findState(item.tokens);
        if (state) {
          return state;
        }
      }
    } else if (token.type === 'table') {
      for (const cell of [...token.header, ...token.rows.flat()]) {
        const state = findState(cell.tokens);
        if (state) {
          return state;
        }
      }
    }
  }
}

export function footnote(options: FootnoteOptions = {}): MarkedExtension {
  const prefix = escapeHtmlEntities(options.prefix || '');
  const extension: TokenizerAndRendererExtension[] = [
    {
      name: 'footnote-definition',
      level: 'block',
      start: (src) => {
        let index = src.indexOf('[^');
        while (index !== -1 && index > 0 && src[index - 1] !== '\n') {
          index = src.indexOf('[^', index + 2);
        }
        return index === -1 ? undefined : index;
      },
      tokenizer: definitionTokenizer,
      renderer: () => '',
    },
    {
      name: 'footnote-reference',
      level: 'inline',
      start: referenceStart,
      tokenizer: referenceTokenizer,
      renderer(token) {
        const referenceToken = token as Tokens.Generic & { state: FootnoteState, label: string };
        const reference = referenceToken.state.references.get(referenceToken.label)
          || (() => {
            const definition = referenceToken.state.definitions.get(referenceToken.label)!;
            const created = {
              definition,
              number: referenceToken.state.order.length + 1,
              count: 0,
            };
            referenceToken.state.references.set(referenceToken.label, created);
            referenceToken.state.order.push(created);
            return created;
          })();
        reference.count++;
        const suffix = reference.count === 1 ? '' : `-${reference.count}`;
        return `<sup class="footnote-ref"><a href="#${prefix}fn-${reference.definition.slug}" id="${prefix}fnref-${reference.definition.slug}${suffix}" data-footnote-ref>${reference.number}</a></sup>`;
      },
    },
    {
      name: 'footnote-end',
      renderer(token) {
        const footnoteToken = token as FootnoteToken;
        if (footnoteToken.state.order.length === 0) {
          return '';
        }
        let output = '<section class="footnotes" data-footnotes><ol>';
        for (let i = 0; i < footnoteToken.state.order.length; i++) {
          const reference = footnoteToken.state.order[i];
          const content = this.parser.parse(reference.definition.tokens);
          output += `<li id="${prefix}fn-${reference.definition.slug}">${appendBackrefs(content, backrefs(reference, prefix))}</li>`;
        }
        output += '</ol></section>\n';
        return output;
      },
    },
  ];

  return {
    hooks: {
      processAllTokens(tokens) {
        const state = findState(tokens as Token[]);
        if (state) {
          (tokens as Token[]).push({
            type: 'footnote-end',
            raw: '',
            state,
          });
        }
        return tokens;
      },
    },
    extensions: extension,
  };
}
