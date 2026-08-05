import { Marked, footnote } from '../../lib/marked.esm.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

const render = (source, options) => new Marked(footnote(options)).parse(source);

describe('Footnotes extension', () => {
  it('renders references and a footnotes section', () => {
    const html = render('Text[^1].\n\n[^1]: A note.');
    assert.strictEqual(html, '<p>Text<sup><a href="#footnote-1" id="footnote-ref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup>.</p>\n<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="footnote-1">\n<p>A note.<a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('numbers by first reference, supports repeats, and folds labels', () => {
    const html = render('[^B] [^a] [^B] [^A]\n\n[^a]: A\n[^B]: B');
    assert.match(html, /id="footnote-ref-1"/);
    assert.match(html, /id="footnote-ref-2"/);
    assert.match(html, /id="footnote-ref-1-2"/);
    assert.match(html, /href="#footnote-ref-1-2".*↩<sup>2<\/sup>/);
    assert.ok(html.indexOf('<li id="footnote-1">') < html.indexOf('<li id="footnote-2">'));
  });

  it('leaves undefined and invalid references literal', () => {
    const html = render('X[^missing] [^] [^ ] \\[^1]');
    assert.strictEqual(html, '<p>X[^missing] [^] [^ ] [^1]</p>\n');
  });

  it('omits unreferenced and duplicate definitions', () => {
    const html = render('[^a]\n\n[^a]: first\n\n[^a]: second\n\n[^unused]: no');
    assert.match(html, /<p>first<a/);
    assert.doesNotMatch(html, /second|unused|footnote-2/);
  });

  it('consumes definitions on consecutive lines', () => {
    const html = render('[^a] [^b]\n\n[^a]: A\n[^b]: B');
    assert.match(html, /<li id="footnote-1">\n<p>A/);
    assert.match(html, /<li id="footnote-2">\n<p>B/);
  });

  it('supports paragraphs, lists, code, and lazy continuation', () => {
    const html = render('Ref[^x]\n\n[^x]: first\n    \n    second paragraph\n    \n    - item\n\nRef[^y]\n\n[^y]: line one\nline two\n\nRef[^z]\n\n[^z]: code\n\n        block');
    assert.match(html, /<p>first<\/p>\n<p>second paragraph/);
    assert.match(html, /<ul>\n<li>item<\/li>/);
    assert.match(html, /line one\nline two/);
    assert.match(html, /<pre><code>block\n<\/code><\/pre>/);
  });

  it('renders an indented multi-block definition without leaking raw source', () => {
    const html = render('Ref[^z]\n\n[^z]: code\n\n        block');
    assert.strictEqual(html, '<p>Ref<sup><a href="#footnote-1" id="footnote-ref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup></p>\n<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="footnote-1">\n<p>code</p>\n<pre><code>block\n</code></pre>\n<p><a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('renders a definition followed by a top-level paragraph', () => {
    const html = render('Ref[^x]\n\n[^x]: note\n\nParagraph.');
    assert.strictEqual(html, '<p>Ref<sup><a href="#footnote-1" id="footnote-ref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup></p>\n<p>Paragraph.</p>\n<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="footnote-1">\n<p>note<a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('stops lazy continuation before new block constructs', () => {
    const blocks = [
      ['# Heading', '<h1>Heading</h1>'],
      ['```js\ncode\n```', '<pre><code class="language-js">code\n</code></pre>'],
      ['~~~\ncode\n~~~', '<pre><code>code\n</code></pre>'],
      ['> quote', '<blockquote>\n<p>quote</p>\n</blockquote>'],
      ['- item', '<ul>\n<li>item</li>\n</ul>'],
      ['1. item', '<ol>\n<li>item</li>\n</ol>'],
      ['***', '<hr>'],
      ['<div>html</div>', '<div>html</div>'],
    ];
    for (const [block, expected] of blocks) {
      const html = render(`Ref[^x]\n\n[^x]: note\n\n${block}`);
      assert.ok(html.includes(expected), block);
      const footnotes = html.slice(html.indexOf('<section class="footnotes"'));
      assert.ok(!footnotes.includes(expected), block);
    }
  });

  it('supports consecutive definitions and references in emphasis and headings', () => {
    const html = render('# Heading [^two]\n\n*em [^one]*\n\n[^one]: One\n[^two]: Two');
    assert.match(html, /<h1>Heading .*footnote-ref-1/);
    assert.match(html, /<em>em .*footnote-ref-2/);
    assert.strictEqual(html.slice(html.indexOf('<section class="footnotes"')), '<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="footnote-1">\n<p>Two<a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩</a></p>\n</li>\n<li id="footnote-2">\n<p>One<a href="#footnote-ref-2" data-footnote-backref aria-label="Back to reference 2">↩</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('supports nested, table-cell, and link-text references', () => {
    const html = render('[^a]\n\n| Note |\n| --- |\n| [^b] |\n\n[link [^c]](/url) ![alt [^c]](/image)\n\n[^a]: see [^b]\n[^b]: B\n[^c]: C');
    assert.match(html, /see <sup><a href="#footnote-2"/);
    assert.match(html, /<td><sup><a href="#footnote-2"/);
    assert.match(html, /<a href="\/url">link \[\^c\]<\/a>/);
    assert.match(html, /alt="alt \[\^c\]"/);
    assert.ok(!html.includes('<li id="footnote-3">'));
  });

  it('keeps refs inside image-containing link text literal', () => {
    const html = render('[![i](/i) [^a]](/url)\n\n[^a]: note');
    assert.match(html, /<a href="\/url"><img src="\/i" alt="i"> \[\^a\]<\/a>/);
    assert.doesNotMatch(html, /<sup><a href="#footnote-/);
    assert.doesNotMatch(html, /<section class="footnotes"/);
  });

  it('keeps list items tight when definitions appear inside list items', () => {
    const html = render('- item[^a]\n  [^a]: first\n\n      second\n- after');
    assert.match(html, /<li>after<\/li>/);
    assert.match(html, /<p>first<\/p>\n<p>second<a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩<\/a><\/p>/);
  });

  it('drops unreachable refs in duplicate definitions with nested content', () => {
    const html = render('[^a]\n\n[^a]: first has [^b]\n\n[^a]: dup has [^c]\n\n[^b]: B\n\n[^c]: C');
    assert.strictEqual(html, '<p><sup><a href="#footnote-1" id="footnote-ref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup></p>\n<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="footnote-1">\n<p>first has <sup><a href="#footnote-2" id="footnote-ref-2" data-footnote-ref aria-describedby="footnote-label">2</a></sup><a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩</a></p>\n</li>\n<li id="footnote-2">\n<p>B<a href="#footnote-ref-2" data-footnote-backref aria-label="Back to reference 2">↩</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('keeps footnotes out of parseInline', () => {
    const marked = new Marked(footnote());
    assert.strictEqual(marked.parseInline('text[^a]'), 'text[^a]');
  });

  it('handles another processAllTokens hook returning a fresh array', () => {
    const marked = new Marked();
    marked.use(footnote());
    marked.use({
      hooks: {
        processAllTokens(tokens) {
          return [...tokens];
        },
      },
    });
    assert.strictEqual(marked.parse('A[^a]\n\n[^a]: note'), '<p>A<sup><a href="#footnote-1" id="footnote-ref-1" data-footnote-ref aria-describedby="footnote-label">1</a></sup></p>\n<section class="footnotes" data-footnotes>\n<h2 id="footnote-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="footnote-1">\n<p>note<a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('does not change documents without footnotes', () => {
    const source = [
      '`[^c]`',
      '\\[^d]',
      'A[^a] B[^b]',
      '',
      '[^a] more',
    ].join('\n');
    assert.strictEqual(render(source), new Marked().parse(source));
  });

  it('does not clip paragraph text that resembles a definition', () => {
    for (const source of ['a [^b]: c', 'a [^ b]: c']) {
      assert.strictEqual(render(source), new Marked().parse(source));
    }
    const tokens = new Marked(footnote()).lexer('[^a]: note\n\n[^a]');
    assert.ok(tokens.some(token => token.type === 'footnoteDefinition'));
  });

  it('strips all whitespace after a definition marker', () => {
    for (const source of ['A[^a]\n\n[^a]:\tnote', 'A[^a]\n\n[^a]:     note']) {
      const html = render(source);
      assert.match(html, /<li id="footnote-1">\n<p>note<a href="#footnote-ref-1"/);
      assert.doesNotMatch(html, /<pre><code>note/);
    }
  });

  it('keeps indented continuation after multiple blank lines', () => {
    const html = render('A[^a]\n\n[^a]: first\n\n\n    second');
    assert.match(html, /<p>first<\/p>\n<p>second<a href="#footnote-ref-1"/);
    assert.doesNotMatch(html, /<pre><code>second/);
  });

  it('requires whitespace after the definition marker colon', () => {
    assert.strictEqual(render('A[^a]:note'), '<p>A[^a]:note</p>\n');
    assert.match(render('A[^a]\n\n[^a]:'), /<li id="footnote-1">\n<p><a href="#footnote-ref-1"/);
  });

  it('includes only definitions reachable from document references', () => {
    const html = render('[^a]\n\n[^a]: A contains [^b]\n\n[^b]: B\n\n[^c]: C');
    assert.match(html, /A contains <sup><a href="#footnote-2"/);
    assert.ok(html.includes('<li id="footnote-1">'));
    assert.ok(html.includes('<li id="footnote-2">'));
    assert.ok(!html.includes('>C<a'));
  });

  it('does not parse references in code spans', () => {
    const html = render('`[^1]`\n\n[^1]: note');
    assert.strictEqual(html, '<p><code>[^1]</code></p>\n');
  });

  it('masks references while parsing emphasis', () => {
    assert.strictEqual(render('*a[^x*y]b*'), '<p><em>a[^x*y]b</em></p>\n');
    assert.strictEqual(render('_foo[^a_b]bar_'), '<p><em>foo[^a_b]bar</em></p>\n');
  });

  it('supports async parsing', async() => {
    const source = 'Text[^1].\n\n[^1]: note';
    const sync = render(source);
    const marked = new Marked({ async: true });
    marked.use(footnote());
    assert.strictEqual(await marked.parse(source), sync);
  });

  it('isolates concurrent async parses', async() => {
    const marked = new Marked({ async: true });
    marked.use(footnote());
    const [a, b] = await Promise.all([
      marked.parse('A[^a]\n\n[^a]: A note'),
      marked.parse('B[^b]\n\n[^b]: B note'),
    ]);
    assert.match(a, /A<sup><a href="#footnote-1"/);
    assert.doesNotMatch(a, /B note|footnote-2/);
    assert.match(b, /B<sup><a href="#footnote-1"/);
    assert.doesNotMatch(b, /A note|footnote-2/);
  });

  it('drops the section when there are no references and preserves ordinary markdown', () => {
    assert.strictEqual(render('plain markdown'), '<p>plain markdown</p>\n');
    assert.strictEqual(render('A definition only\n\n[^x]: hidden'), '<p>A definition only</p>\n');
  });

  it('resets state between parses and supports custom prefixes', () => {
    const marked = new Marked(footnote({ prefix: 'fn-', backRefLabel: 'back' }));
    const html = marked.parse('A[^a]\n\n[^a]: note');
    assert.strictEqual(html, '<p>A<sup><a href="#fn-1" id="fn-ref-1" data-footnote-ref aria-describedby="fn-label">1</a></sup></p>\n<section class="footnotes" data-footnotes>\n<h2 id="fn-label" class="sr-only">Footnotes</h2>\n<ol>\n<li id="fn-1">\n<p>note<a href="#fn-ref-1" data-footnote-backref aria-label="Back to reference 1">back</a></p>\n</li>\n</ol>\n</section>\n');
    const second = marked.parse('B[^b]\n\n[^b]: note');
    assert.match(second, /id="fn-ref-1"/);
    assert.match(second, /aria-describedby="fn-label"/);
  });

  it('falls back to literal references for manual lexer-parser usage', () => {
    const marked = new Marked(footnote());
    const tokens = marked.lexer('A[^<img src=x onerror=alert(1)>]\n\n[^<img src=x onerror=alert(1)>]: note');
    assert.strictEqual(marked.parser(tokens), '<p>A[^&lt;img src=x onerror=alert(1)&gt;]</p>\n');
  });

  it('escapes option values in rendered output', () => {
    const html = render('A[^a]\n\n[^a]: note', { prefix: 'f"n&', backRefLabel: '<back>', label: 'Foot & Notes' });
    assert.strictEqual(html, '<p>A<sup><a href="#f&quot;n&amp;1" id="f&quot;n&amp;ref-1" data-footnote-ref aria-describedby="f&quot;n&amp;label">1</a></sup></p>\n<section class="footnotes" data-footnotes>\n<h2 id="f&quot;n&amp;label" class="sr-only">Foot &amp; Notes</h2>\n<ol>\n<li id="f&quot;n&amp;1">\n<p>note<a href="#f&quot;n&amp;ref-1" data-footnote-backref aria-label="Back to reference 1">&lt;back&gt;</a></p>\n</li>\n</ol>\n</section>\n');
  });

  it('exposes token fields and visits extension tokens', () => {
    const marked = new Marked(footnote());
    const types = [];
    let ref;
    let definition;
    marked.parse('A[^a]\n\n[^a]: note', {
      walkTokens(token) {
        types.push(token.type);
        if (token.type === 'footnoteRef') {
          ref = token;
        }
        if (token.type === 'footnoteDefinition') {
          definition = token;
        }
      },
    });
    assert.deepStrictEqual({ raw: ref.raw, label: ref.label, index: ref.index, refIndex: ref.refIndex }, {
      raw: '[^a]', label: 'a', index: 1, refIndex: 1,
    });
    assert.strictEqual(definition.label, 'a');
    assert.ok(types.includes('footnoteRef'));
    assert.ok(types.includes('footnoteDefinition'));
  });

  it('walks footnote content tokens exactly once', () => {
    const marked = new Marked(footnote());
    let contentVisits = 0;
    marked.parse('A[^a]\n\n[^a]: content', {
      walkTokens(token) {
        if (token.type === 'text' && token.raw === 'content') {
          contentVisits++;
        }
      },
    });
    assert.strictEqual(contentVisits, 1);
  });
});
