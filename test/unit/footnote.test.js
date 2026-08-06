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
    assert.strictEqual((html.match(/class="footnote-ref"/g) || []).length, 2);
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
