import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Marked, footnote } from '../../lib/marked.esm.js';

const withFootnotes = () => new Marked(footnote());

describe('footnote extension', () => {
  it('renders a single footnote', () => {
    const html = withFootnotes().parse('Text[^1].\n\n[^1]: Note');
    assert.match(html, /Text<sup class="footnote-ref"><a href="#fn-1" id="fnref-1" data-footnote-ref>1<\/a><\/sup>\./);
    assert.match(html, /<section class="footnotes" data-footnotes><ol><li id="fn-1"><p>Note <a href="#fnref-1" class="footnote-backref"/);
  });

  it('numbers references by first reference order', () => {
    const html = withFootnotes().parse('First[^b], then[^a].\n\n[^a]: A\n[^b]: B');
    assert.match(html, /href="#fn-b" id="fnref-b"[^>]*>1/);
    assert.match(html, /href="#fn-a" id="fnref-a"[^>]*>2/);
    assert.ok(html.indexOf('<li id="fn-b"') < html.indexOf('<li id="fn-a"'));
  });

  it('shares numbers and emits multiple backrefs for repeated references', () => {
    const html = withFootnotes().parse('[^1] and [^1].\n\n[^1]: Note');
    assert.match(html, /id="fnref-1-2"/);
    assert.strictEqual((html.match(/class="footnote-backref"/g) || []).length, 2);
    assert.match(html, /aria-label="Back to reference 1-2"/);
  });

  it('leaves undefined references as text and omits unreferenced definitions', () => {
    const html = withFootnotes().parse('Missing [^missing].\n\n[^unused]: Not shown');
    assert.match(html, /\[\^missing\]/);
    assert.doesNotMatch(html, /footnotes/);
    assert.doesNotMatch(html, /Not shown/);
  });

  it('supports multiline definitions and inline markdown', () => {
    const markdown = 'Text[^1].\n\n[^1]: **bold** text\n    continued\n\n    second paragraph';
    const html = withFootnotes().parse(markdown);
    assert.match(html, /<strong>bold<\/strong> text\ncontinued/);
    assert.match(html, /<p>second paragraph/);
  });

  it('does not transform escaped references, code spans, or fenced code', () => {
    const markdown = 'Escaped \\[^1] and `[^1]`.\n\n~~~md\n[^1]\n~~~\n\n[^1]: Note';
    const html = withFootnotes().parse(markdown);
    assert.match(html, /Escaped \[\^1\]/);
    assert.match(html, /<code>\[\^1\]<\/code>/);
    assert.match(html, /<pre><code class="language-md">\[\^1\]\n<\/code><\/pre>/);
    assert.doesNotMatch(html, /footnote-ref/);
  });

  it('finds references at the start of an inline remainder and after escapes', () => {
    const markdown = 'a[^1] rest.\n\nEscaped \\* then [^1].\n\n[^1]: Note';
    const html = withFootnotes().parse(markdown);
    const reference = '<sup class="footnote-ref"><a href="#fn-1" id="fnref-1" data-footnote-ref>1</a></sup>';
    assert.match(html, new RegExp(`a${reference} rest\\.`));
    assert.match(html, /Escaped \* then <sup class="footnote-ref"><a href="#fn-1" id="fnref-1-2" data-footnote-ref>1<\/a><\/sup>\./);
    const breaksHtml = withFootnotes().parse('a[^1] rest.\n\n[^1]: Note', { breaks: true });
    assert.match(breaksHtml, new RegExp(`a${reference} rest\\.`));
  });

  it('updates backrefs after later footnote bodies add references', () => {
    const markdown = 'X[^a] Y[^b].\n\n[^a]: A\n[^b]: B refs [^a].';
    const html = withFootnotes().parse(markdown);
    assert.match(html, /id="fnref-a"[^>]*>1/);
    assert.match(html, /id="fnref-a-2"[^>]*>1/);
    assert.match(html, /href="#fnref-a" class="footnote-backref"/);
    assert.match(html, /href="#fnref-a-2" class="footnote-backref"/);
  });

  it('strips all whitespace after a definition colon', () => {
    const html = withFootnotes().parse('Text[^1].\n\n[^1]:      Note');
    assert.match(html, /<li id="fn-1"><p>Note /);
    assert.doesNotMatch(html, /<pre><code>/);
  });

  it('keeps the first definition when labels are duplicated', () => {
    const markdown = 'Text[^1].\n\n[^1]: First\n[^1]: Second';
    const html = withFootnotes().parse(markdown);
    assert.match(html, /First/);
    assert.doesNotMatch(html, /Second/);
    assert.doesNotMatch(html, /fn-1-2/);
  });

  it('does not clip a line-start reference that is not a definition', () => {
    const html = withFootnotes().parse('[^1] text.\n\n[^1]: Note');
    assert.match(html, /<p><sup class="footnote-ref"><a href="#fn-1"/);
    assert.match(html, /<\/a><\/sup> text\.<\/p>/);
  });

  it('places backrefs after block content when a definition ends in a list', () => {
    const markdown = 'Text[^1].\n\n[^1]:\n\n    - item';
    const html = withFootnotes().parse(markdown);
    assert.match(html, /<ul>\n<li>item<\/li>\n<\/ul>\n<p><a href="#fnref-1" class="footnote-backref"/);
  });

  it('restores list context after lexing a definition body', () => {
    const markdown = '- [^1]: Note\n  following text\n\nText[^1]';
    const html = withFootnotes().parse(markdown);
    assert.match(html, /<ul>\n<li>following text<\/li>\n<\/ul>/);
    assert.match(html, /<li id="fn-1"><p>Note /);
  });

  it('walks tokens inside footnote bodies', () => {
    const seen = [];
    const marked = new Marked(footnote());
    marked.use({
      walkTokens(token) {
        if (token.type === 'paragraph') {
          seen.push(token.text);
        }
      },
    });
    marked.parse('Text[^1].\n\n[^1]: Body\n[^1]: Duplicate');
    assert.strictEqual(seen.filter(text => text === 'Body').length, 1);
  });

  it('does not count or render references inside image alt text', () => {
    const html = withFootnotes().parse('![alt [^1]](img.png)\n\n[^1]: Note');
    assert.match(html, /alt="alt \[\^1\]"/);
    assert.doesNotMatch(html, /footnote-ref|footnote-backref|data-footnotes/);
  });

  it('escapes unresolved references in manual lexer/parser flows', () => {
    const marked = new Marked(footnote());
    const markdown = 'Text[^<svg/onload=alert(1)>].\n\n[^<svg/onload=alert(1)>]: Note';
    const html = marked.parser(marked.lexer(markdown));
    assert.match(html, /&lt;svg\/onload=alert\(1\)&gt;/);
    assert.doesNotMatch(html, /<svg/);
  });

  it('renders the same source identically on repeated parses', () => {
    const marked = withFootnotes();
    const markdown = 'Text[^1] and [^1].\n\n[^1]: Note';
    assert.strictEqual(marked.parse(markdown), marked.parse(markdown));
  });

  it('does not duplicate the section when installing footnotes twice', () => {
    const marked = new Marked();
    marked.use(footnote());
    marked.use(footnote());
    const html = marked.parse('Text[^1].\n\n[^1]: Note');
    assert.strictEqual((html.match(/data-footnotes/g) || []).length, 1);
  });

  it('supports an id prefix', () => {
    const html = new Marked(footnote({ prefix: 'user-content-' })).parse('Text[^a].\n\n[^a]: Note');
    assert.match(html, /href="#user-content-fn-a" id="user-content-fnref-a"/);
    assert.match(html, /<li id="user-content-fn-a"/);
  });

  it('does not add a section when there are no references', () => {
    assert.doesNotMatch(withFootnotes().parse('No footnotes here.'), /data-footnotes/);
  });

  it('does not leak state between sequential parses', () => {
    const marked = withFootnotes();
    const first = marked.parse('One[^1].\n\n[^1]: First');
    const second = marked.parse('Two[^2].\n\n[^2]: Second');
    assert.match(first, /fn-1/);
    assert.doesNotMatch(first, /Second/);
    assert.match(second, /fn-2/);
    assert.doesNotMatch(second, /First/);
  });

  it('renders references inside emphasis and table cells', () => {
    const markdown = '*Em[^1]*\n\n| Cell |\n| --- |\n| [^1] |\n\n[^1]: Note';
    const html = withFootnotes().parse(markdown);
    assert.strictEqual((html.match(/class="footnote-ref"/g) || []).length, 2);
  });

  it('supports async parsing', async() => {
    const html = await withFootnotes().parse('Async[^1].\n\n[^1]: Note', { async: true });
    assert.match(html, /data-footnotes/);
  });

  it('does not leak a sentinel into an unterminated fenced code block', () => {
    const html = withFootnotes().parse('~~~\n[^1]\n');
    assert.match(html, /<pre><code>\[\^1\]\n<\/code><\/pre>/);
    assert.doesNotMatch(html, /marked-footnotes|data-footnotes/);
  });

  it('keeps escaped references intact inside fenced code blocks', () => {
    const html = withFootnotes().parse('~~~\n\\[^1]\n~~~\n\n[^1]: Note');
    assert.match(html, /<pre><code>\\\[\^1\]\n<\/code><\/pre>/);
  });

  it('renders a footnote referenced from another footnote', () => {
    const markdown = 'Main[^main].\n\n[^main]: Main body references [^nested].\n[^nested]: Nested body';
    const html = withFootnotes().parse(markdown);
    assert.ok(html.indexOf('<li id="fn-main"') < html.indexOf('<li id="fn-nested"'));
    assert.match(html, /href="#fn-nested"[^>]*>2</);
  });
});
