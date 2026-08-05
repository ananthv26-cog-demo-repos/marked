import { Marked, footnote } from '../../lib/marked.esm.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

const render = (source, options) => new Marked(footnote(options)).parse(source);

describe('Footnotes extension', () => {
  it('renders references and a footnotes section', () => {
    const html = render('Text[^1].\n\n[^1]: A note.');
    assert.match(html, /Text<sup><a href="#footnote-1" id="footnote-ref-1" data-footnote-ref aria-describedby="footnote-label">1<\/a><\/sup>\./);
    assert.match(html, /<section class="footnotes" data-footnotes>\n<ol>\n<li id="footnote-1">\n<p>A note\.<a href="#footnote-ref-1" data-footnote-backref aria-label="Back to reference 1">↩<\/a><\/p>/);
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

  it('supports consecutive definitions and references in emphasis and headings', () => {
    const html = render('# Heading [^two]\n\n*em [^one]*\n\n[^one]: One\n[^two]: Two');
    assert.match(html, /<h1>Heading .*footnote-ref-1/);
    assert.match(html, /<em>em .*footnote-ref-2/);
    assert.match(html, /One|Two/);
  });

  it('drops the section when there are no references and preserves ordinary markdown', () => {
    assert.strictEqual(render('plain markdown'), '<p>plain markdown</p>\n');
    assert.strictEqual(render('A definition only\n\n[^x]: hidden'), '<p>A definition only</p>\n');
  });

  it('resets state between parses and supports custom prefixes', () => {
    const marked = new Marked(footnote({ prefix: 'fn-', backRefLabel: 'back' }));
    assert.match(marked.parse('A[^a]\n\n[^a]: note'), /#fn-1|#fn-ref-1/);
    const second = marked.parse('B[^b]\n\n[^b]: note');
    assert.match(second, /id="fn-ref-1"/);
    assert.match(second, />back<\/a>/);
  });

  it('exposes token fields and visits extension tokens', () => {
    const marked = new Marked(footnote());
    const tokens = marked.lexer('A[^a]\n\n[^a]: note');
    const types = [];
    marked.walkTokens(tokens, token => types.push(token.type));
    const ref = tokens[0].tokens.find(token => token.type === 'footnoteRef');
    const definition = tokens.find(token => token.type === 'footnoteDefinition');
    assert.deepStrictEqual({ raw: ref.raw, label: ref.label, index: ref.index, refIndex: ref.refIndex }, {
      raw: '[^a]', label: 'a', index: 1, refIndex: 1,
    });
    assert.strictEqual(definition.label, 'a');
    assert.ok(types.includes('footnoteRef'));
    assert.ok(types.includes('footnoteDefinition'));
  });
});
