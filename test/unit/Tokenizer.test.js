import { Lexer } from '../../lib/marked.esm.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

function getTokenizer(options) {
  const lexer = new Lexer(options);
  return lexer.tokenizer;
}

describe('Tokenizer', () => {
  describe('space', () => {
    it('should return space token for multiple newlines', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.space('\n\n');
      assert.deepEqual(token, { type: 'space', raw: '\n\n' });
    });

    it('should return space token for single newline', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.space('\n');
      assert.deepEqual(token, { type: 'space', raw: '\n' });
    });

    it('should return undefined for empty string', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.space('');
      assert.strictEqual(token, undefined);
    });

    it('should return undefined for non-newline text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.space('hello');
      assert.strictEqual(token, undefined);
    });
  });

  describe('code', () => {
    it('should tokenize indented code block', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.code('    code\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'code');
      assert.strictEqual(token.text, 'code\n');
      assert.strictEqual(token.codeBlockStyle, 'indented');
    });

    it('should return undefined for non-code text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.code('not code');
      assert.strictEqual(token, undefined);
    });

    it('should handle multi-line indented code', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.code('    line1\n    line2\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'code');
      assert.ok(token.text.includes('line1'));
      assert.ok(token.text.includes('line2'));
    });
  });

  describe('fences', () => {
    it('should tokenize fenced code block', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.fences('```\ncode\n```');
      assert.ok(token);
      assert.strictEqual(token.type, 'code');
      assert.strictEqual(token.text, 'code');
      assert.strictEqual(token.lang, '');
    });

    it('should tokenize fenced code block with language', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.fences('```javascript\ncode\n```');
      assert.ok(token);
      assert.strictEqual(token.type, 'code');
      assert.strictEqual(token.lang, 'javascript');
      assert.strictEqual(token.text, 'code');
    });

    it('should return undefined for non-fenced text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.fences('not fenced code');
      assert.strictEqual(token, undefined);
    });

    it('should handle empty fenced code block', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.fences('```\n```');
      assert.ok(token);
      assert.strictEqual(token.type, 'code');
      assert.strictEqual(token.text, '');
    });

    it('should handle tilde fences', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.fences('~~~\ncode\n~~~');
      assert.ok(token);
      assert.strictEqual(token.type, 'code');
      assert.strictEqual(token.text, 'code');
    });
  });

  describe('heading', () => {
    it('should tokenize heading level 1', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.heading('# heading 1\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'heading');
      assert.strictEqual(token.depth, 1);
      assert.strictEqual(token.text, 'heading 1');
    });

    it('should tokenize heading level 2', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.heading('## heading 2\n');
      assert.ok(token);
      assert.strictEqual(token.depth, 2);
      assert.strictEqual(token.text, 'heading 2');
    });

    it('should tokenize heading level 6', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.heading('###### heading 6\n');
      assert.ok(token);
      assert.strictEqual(token.depth, 6);
      assert.strictEqual(token.text, 'heading 6');
    });

    it('should return undefined for non-heading text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.heading('not a heading');
      assert.strictEqual(token, undefined);
    });

    it('should strip trailing hashes with preceding space', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.heading('## heading ##\n');
      assert.ok(token);
      assert.strictEqual(token.text, 'heading');
    });

    it('should not strip trailing hashes without preceding space', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.heading('## heading##\n');
      assert.ok(token);
      assert.strictEqual(token.text, 'heading##');
    });
  });

  describe('hr', () => {
    it('should tokenize hr with dashes', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.hr('---\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'hr');
    });

    it('should tokenize hr with asterisks', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.hr('***\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'hr');
    });

    it('should tokenize hr with underscores', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.hr('___\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'hr');
    });

    it('should return undefined for non-hr text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.hr('not a hr');
      assert.strictEqual(token, undefined);
    });
  });

  describe('blockquote', () => {
    it('should tokenize simple blockquote', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.blockquote('> blockquote\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'blockquote');
      assert.strictEqual(token.text, 'blockquote');
    });

    it('should return undefined for non-blockquote text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.blockquote('not a blockquote');
      assert.strictEqual(token, undefined);
    });

    it('should tokenize multi-line blockquote', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.blockquote('> line1\n> line2\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'blockquote');
      assert.ok(token.text.includes('line1'));
      assert.ok(token.text.includes('line2'));
    });
  });

  describe('list', () => {
    it('should tokenize unordered list', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.list('- item 1\n- item 2\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'list');
      assert.strictEqual(token.ordered, false);
      assert.strictEqual(token.items.length, 2);
    });

    it('should tokenize ordered list', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.list('1. item 1\n2. item 2\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'list');
      assert.strictEqual(token.ordered, true);
      assert.strictEqual(token.start, 1);
      assert.strictEqual(token.items.length, 2);
    });

    it('should tokenize ordered list with custom start', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.list('3. item a\n4. item b\n');
      assert.ok(token);
      assert.strictEqual(token.ordered, true);
      assert.strictEqual(token.start, 3);
    });

    it('should return undefined for non-list text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.list('not a list');
      assert.strictEqual(token, undefined);
    });

    it('should detect task list items', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.list('- [x] done\n- [ ] todo\n');
      assert.ok(token);
      assert.strictEqual(token.items[0].task, true);
      assert.strictEqual(token.items[1].task, true);
    });

    it('should handle list with asterisks', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.list('* item 1\n* item 2\n');
      assert.ok(token);
      assert.strictEqual(token.ordered, false);
      assert.strictEqual(token.items.length, 2);
    });

    it('should handle list with plus signs', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.list('+ item 1\n+ item 2\n');
      assert.ok(token);
      assert.strictEqual(token.ordered, false);
      assert.strictEqual(token.items.length, 2);
    });
  });

  describe('html', () => {
    it('should tokenize block html', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.html('<div>\nhtml content\n</div>\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'html');
      assert.strictEqual(token.block, true);
    });

    it('should set pre flag for pre tags', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.html('<pre>\npreformatted\n</pre>\n');
      assert.ok(token);
      assert.strictEqual(token.pre, true);
    });

    it('should set pre flag for script tags', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.html('<script>\nconsole.log("test");\n</script>\n');
      assert.ok(token);
      assert.strictEqual(token.pre, true);
    });

    it('should return undefined for non-html text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.html('not html');
      assert.strictEqual(token, undefined);
    });
  });

  describe('def', () => {
    it('should tokenize link definition', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.def('[link]: https://example.com "title"\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'def');
      assert.strictEqual(token.tag, 'link');
      assert.strictEqual(token.href, 'https://example.com');
      assert.strictEqual(token.title, 'title');
    });

    it('should tokenize link definition without title', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.def('[link]: https://example.com\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'def');
      assert.strictEqual(token.tag, 'link');
      assert.strictEqual(token.href, 'https://example.com');
    });

    it('should return undefined for non-def text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.def('not a definition');
      assert.strictEqual(token, undefined);
    });
  });

  describe('table', () => {
    it('should tokenize simple table', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.table('| a | b |\n|---|---|\n| 1 | 2 |\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'table');
      assert.strictEqual(token.header.length, 2);
      assert.strictEqual(token.rows.length, 1);
    });

    it('should tokenize aligned table', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.table('| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n');
      assert.ok(token);
      assert.deepEqual(token.align, ['left', 'center', 'right']);
    });

    it('should return undefined for non-table text', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.table('not a table');
      assert.strictEqual(token, undefined);
    });

    it('should return undefined when header and align columns differ', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.table('| a | b | c |\n|---|---|\n| 1 | 2 | 3 |\n');
      assert.strictEqual(token, undefined);
    });

    it('should handle table with no rows', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.table('| a | b |\n|---|---|\n');
      assert.ok(token);
      assert.strictEqual(token.rows.length, 0);
    });
  });

  describe('lheading', () => {
    it('should tokenize setext heading level 1', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.lheading('heading\n=======\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'heading');
      assert.strictEqual(token.depth, 1);
      assert.strictEqual(token.text, 'heading');
    });

    it('should tokenize setext heading level 2', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.lheading('heading\n-------\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'heading');
      assert.strictEqual(token.depth, 2);
      assert.strictEqual(token.text, 'heading');
    });

    it('should return undefined for non-lheading text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.lheading('not a heading');
      assert.strictEqual(token, undefined);
    });
  });

  describe('paragraph', () => {
    it('should tokenize paragraph', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.paragraph('paragraph text\n');
      assert.ok(token);
      assert.strictEqual(token.type, 'paragraph');
      assert.strictEqual(token.text, 'paragraph text');
    });

    it('should return undefined for empty string', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.paragraph('');
      assert.strictEqual(token, undefined);
    });
  });

  describe('text', () => {
    it('should tokenize text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.text('some text');
      assert.ok(token);
      assert.strictEqual(token.type, 'text');
      assert.strictEqual(token.text, 'some text');
    });

    it('should return undefined for empty string', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.text('');
      assert.strictEqual(token, undefined);
    });
  });

  describe('escape', () => {
    it('should tokenize escaped character', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.escape('\\*');
      assert.ok(token);
      assert.strictEqual(token.type, 'escape');
      assert.strictEqual(token.text, '*');
    });

    it('should tokenize escaped bracket', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.escape('\\[');
      assert.ok(token);
      assert.strictEqual(token.type, 'escape');
      assert.strictEqual(token.text, '[');
    });

    it('should return undefined for non-escape text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.escape('hello');
      assert.strictEqual(token, undefined);
    });
  });

  describe('codespan', () => {
    it('should tokenize inline code', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.codespan('`code`');
      assert.ok(token);
      assert.strictEqual(token.type, 'codespan');
      assert.strictEqual(token.text, 'code');
    });

    it('should tokenize double backtick code', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.codespan('``code with ` backtick``');
      assert.ok(token);
      assert.strictEqual(token.type, 'codespan');
      assert.ok(token.text.includes('`'));
    });

    it('should strip leading and trailing space when non-space chars exist', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.codespan('` code `');
      assert.ok(token);
      assert.strictEqual(token.text, 'code');
    });

    it('should return undefined for non-codespan text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.codespan('hello');
      assert.strictEqual(token, undefined);
    });

    it('should replace newlines with spaces', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.codespan('`line1\nline2`');
      assert.ok(token);
      assert.strictEqual(token.text, 'line1 line2');
    });
  });

  describe('br', () => {
    it('should tokenize two-space line break', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.br('  \ntext');
      assert.ok(token);
      assert.strictEqual(token.type, 'br');
      assert.strictEqual(token.raw, '  \n');
    });

    it('should return undefined when no content follows newline', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.br('  \n');
      assert.strictEqual(token, undefined);
    });

    it('should return undefined for plain text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.br('hello');
      assert.strictEqual(token, undefined);
    });
  });

  describe('autolink', () => {
    it('should tokenize url autolink', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.autolink('<https://example.com>');
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.href, 'https://example.com');
      assert.strictEqual(token.text, 'https://example.com');
    });

    it('should tokenize email autolink', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.autolink('<user@example.com>');
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.href, 'mailto:user@example.com');
      assert.strictEqual(token.text, 'user@example.com');
    });

    it('should return undefined for non-autolink text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.autolink('hello');
      assert.strictEqual(token, undefined);
    });
  });

  describe('tag', () => {
    it('should tokenize inline html tag', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.tag('<div>');
      assert.ok(token);
      assert.strictEqual(token.type, 'html');
      assert.strictEqual(token.text, '<div>');
      assert.strictEqual(token.block, false);
    });

    it('should return undefined for non-tag text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.tag('hello');
      assert.strictEqual(token, undefined);
    });

    it('should track link state for anchor tags', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.tag('<a href="test">');
      assert.ok(token);
      assert.strictEqual(token.inLink, true);
    });

    it('should detect raw block for pre/script/style tags', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.tag('<pre>');
      assert.ok(token);
      assert.strictEqual(token.inRawBlock, true);
    });
  });

  describe('link', () => {
    it('should tokenize inline link', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.link('[text](https://example.com)');
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.href, 'https://example.com');
      assert.strictEqual(token.text, 'text');
    });

    it('should tokenize link with title', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.link('[text](https://example.com "title")');
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.title, 'title');
    });

    it('should tokenize image link', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.link('![alt](image.png)');
      assert.ok(token);
      assert.strictEqual(token.type, 'image');
      assert.strictEqual(token.href, 'image.png');
      assert.strictEqual(token.text, 'alt');
    });

    it('should return undefined for non-link text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.link('hello');
      assert.strictEqual(token, undefined);
    });

    it('should handle link with angle brackets', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.link('[text](<https://example.com>)');
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.href, 'https://example.com');
    });

    it('should handle link with empty href', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.link('[text]()');
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.href, '');
    });
  });

  describe('reflink', () => {
    it('should tokenize reference link', () => {
      const tokenizer = getTokenizer();
      const links = { link: { href: 'https://example.com', title: 'title' } };
      const token = tokenizer.reflink('[text][link]', links);
      assert.ok(token);
      assert.strictEqual(token.type, 'link');
      assert.strictEqual(token.href, 'https://example.com');
    });

    it('should return text token for undefined reference', () => {
      const tokenizer = getTokenizer();
      const links = {};
      const token = tokenizer.reflink('[text][missing]', links);
      assert.ok(token);
      assert.strictEqual(token.type, 'text');
      assert.strictEqual(token.text, '[');
    });
  });

  describe('emStrong', () => {
    it('should tokenize emphasis', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.emStrong('*emphasis*', '*emphasis*');
      assert.ok(token);
      assert.strictEqual(token.type, 'em');
      assert.strictEqual(token.text, 'emphasis');
    });

    it('should tokenize strong', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.emStrong('**strong**', '**strong**');
      assert.ok(token);
      assert.strictEqual(token.type, 'strong');
      assert.strictEqual(token.text, 'strong');
    });

    it('should tokenize underscore emphasis', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.emStrong('_emphasis_', '_emphasis_');
      assert.ok(token);
      assert.strictEqual(token.type, 'em');
      assert.strictEqual(token.text, 'emphasis');
    });

    it('should tokenize underscore strong', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.emStrong('__strong__', '__strong__');
      assert.ok(token);
      assert.strictEqual(token.type, 'strong');
      assert.strictEqual(token.text, 'strong');
    });

    it('should return undefined for non-emphasis text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.emStrong('hello', 'hello');
      assert.strictEqual(token, undefined);
    });
  });

  describe('del', () => {
    it('should tokenize strikethrough', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.del('~~deleted~~', '~~deleted~~');
      assert.ok(token);
      assert.strictEqual(token.type, 'del');
      assert.strictEqual(token.text, 'deleted');
    });

    it('should return undefined for non-del text', () => {
      const tokenizer = getTokenizer({ gfm: true });
      const token = tokenizer.del('hello', 'hello');
      assert.strictEqual(token, undefined);
    });
  });

  describe('inlineText', () => {
    it('should tokenize plain text', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.inlineText('hello world');
      assert.ok(token);
      assert.strictEqual(token.type, 'text');
      assert.strictEqual(token.text, 'hello world');
    });

    it('should return undefined for empty string', () => {
      const tokenizer = getTokenizer();
      const token = tokenizer.inlineText('');
      assert.strictEqual(token, undefined);
    });
  });
});
