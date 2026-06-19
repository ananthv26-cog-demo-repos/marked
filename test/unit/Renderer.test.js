import { Parser } from '../../lib/marked.esm.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

function getRenderer(options) {
  const parser = new Parser(options);
  return parser.renderer;
}

describe('Renderer', () => {
  describe('space', () => {
    it('should return empty string', () => {
      const renderer = getRenderer();
      const result = renderer.space({ type: 'space', raw: '\n\n' });
      assert.strictEqual(result, '');
    });
  });

  describe('code', () => {
    it('should render code block without language', () => {
      const renderer = getRenderer();
      const result = renderer.code({ text: 'code', lang: '', escaped: false });
      assert.strictEqual(result, '<pre><code>code\n</code></pre>\n');
    });

    it('should render code block with language', () => {
      const renderer = getRenderer();
      const result = renderer.code({ text: 'code', lang: 'javascript', escaped: false });
      assert.ok(result.includes('class="language-javascript"'));
      assert.ok(result.includes('code'));
    });

    it('should escape html in code when not already escaped', () => {
      const renderer = getRenderer();
      const result = renderer.code({ text: '<div>test</div>', lang: '', escaped: false });
      assert.ok(result.includes('&lt;div&gt;'));
    });

    it('should not double-escape html in code when already escaped', () => {
      const renderer = getRenderer();
      const result = renderer.code({ text: '&lt;div&gt;', lang: '', escaped: true });
      assert.ok(result.includes('&lt;div&gt;'));
      assert.ok(!result.includes('&amp;lt;'));
    });

    it('should keep content and add single trailing newline', () => {
      const renderer = getRenderer();
      const result = renderer.code({ text: 'code', lang: '', escaped: false });
      assert.strictEqual(result, '<pre><code>code\n</code></pre>\n');
    });

    it('should escape html in language string', () => {
      const renderer = getRenderer();
      const result = renderer.code({ text: 'code', lang: 'x"><script>', escaped: false });
      assert.ok(result.includes('&quot;'));
      assert.ok(!result.includes('<script>'));
    });
  });

  describe('blockquote', () => {
    it('should render blockquote', () => {
      const renderer = getRenderer();
      const result = renderer.blockquote({
        type: 'blockquote',
        raw: '> text',
        text: 'text',
        tokens: [{ type: 'paragraph', text: 'text', tokens: [{ type: 'text', text: 'text' }] }],
      });
      assert.ok(result.startsWith('<blockquote>'));
      assert.ok(result.endsWith('</blockquote>\n'));
    });
  });

  describe('html', () => {
    it('should pass through html', () => {
      const renderer = getRenderer();
      const result = renderer.html({ type: 'html', text: '<div>test</div>', raw: '<div>test</div>', block: true, pre: false });
      assert.strictEqual(result, '<div>test</div>');
    });
  });

  describe('def', () => {
    it('should return empty string', () => {
      const renderer = getRenderer();
      const result = renderer.def({ type: 'def', tag: 'link', raw: '[link]: url', href: 'url', title: 'title' });
      assert.strictEqual(result, '');
    });
  });

  describe('heading', () => {
    it('should render heading with correct depth', () => {
      const renderer = getRenderer();
      const result = renderer.heading({
        type: 'heading',
        raw: '# heading',
        depth: 1,
        text: 'heading',
        tokens: [{ type: 'text', text: 'heading' }],
      });
      assert.strictEqual(result, '<h1>heading</h1>\n');
    });

    it('should render heading level 3', () => {
      const renderer = getRenderer();
      const result = renderer.heading({
        type: 'heading',
        raw: '### heading',
        depth: 3,
        text: 'heading',
        tokens: [{ type: 'text', text: 'heading' }],
      });
      assert.strictEqual(result, '<h3>heading</h3>\n');
    });

    it('should render heading level 6', () => {
      const renderer = getRenderer();
      const result = renderer.heading({
        type: 'heading',
        raw: '###### heading',
        depth: 6,
        text: 'heading',
        tokens: [{ type: 'text', text: 'heading' }],
      });
      assert.strictEqual(result, '<h6>heading</h6>\n');
    });
  });

  describe('hr', () => {
    it('should render hr', () => {
      const renderer = getRenderer();
      const result = renderer.hr({ type: 'hr', raw: '---' });
      assert.strictEqual(result, '<hr>\n');
    });
  });

  describe('list', () => {
    it('should render unordered list', () => {
      const renderer = getRenderer();
      const result = renderer.list({
        type: 'list',
        raw: '- item 1\n- item 2',
        ordered: false,
        start: '',
        loose: false,
        items: [
          { type: 'list_item', raw: '- item 1', task: false, loose: false, text: 'item 1', tokens: [{ type: 'text', text: 'item 1', tokens: [{ type: 'text', text: 'item 1' }] }] },
          { type: 'list_item', raw: '- item 2', task: false, loose: false, text: 'item 2', tokens: [{ type: 'text', text: 'item 2', tokens: [{ type: 'text', text: 'item 2' }] }] },
        ],
      });
      assert.ok(result.startsWith('<ul>'));
      assert.ok(result.includes('<li>'));
      assert.ok(result.endsWith('</ul>\n'));
    });

    it('should render ordered list', () => {
      const renderer = getRenderer();
      const result = renderer.list({
        type: 'list',
        raw: '1. item 1',
        ordered: true,
        start: 1,
        loose: false,
        items: [
          { type: 'list_item', raw: '1. item 1', task: false, loose: false, text: 'item 1', tokens: [{ type: 'text', text: 'item 1', tokens: [{ type: 'text', text: 'item 1' }] }] },
        ],
      });
      assert.ok(result.startsWith('<ol>'));
      assert.ok(result.endsWith('</ol>\n'));
    });

    it('should render ordered list with custom start', () => {
      const renderer = getRenderer();
      const result = renderer.list({
        type: 'list',
        raw: '3. item',
        ordered: true,
        start: 3,
        loose: false,
        items: [
          { type: 'list_item', raw: '3. item', task: false, loose: false, text: 'item', tokens: [{ type: 'text', text: 'item', tokens: [{ type: 'text', text: 'item' }] }] },
        ],
      });
      assert.ok(result.includes('start="3"'));
    });

    it('should not include start attribute when start is 1', () => {
      const renderer = getRenderer();
      const result = renderer.list({
        type: 'list',
        raw: '1. item',
        ordered: true,
        start: 1,
        loose: false,
        items: [
          { type: 'list_item', raw: '1. item', task: false, loose: false, text: 'item', tokens: [{ type: 'text', text: 'item', tokens: [{ type: 'text', text: 'item' }] }] },
        ],
      });
      assert.ok(!result.includes('start='));
    });
  });

  describe('listitem', () => {
    it('should render list item', () => {
      const renderer = getRenderer();
      const result = renderer.listitem({
        type: 'list_item',
        raw: '- item',
        task: false,
        loose: false,
        text: 'item',
        tokens: [{ type: 'text', text: 'item', tokens: [{ type: 'text', text: 'item' }] }],
      });
      assert.ok(result.startsWith('<li>'));
      assert.ok(result.includes('item'));
      assert.ok(result.endsWith('</li>\n'));
    });
  });

  describe('checkbox', () => {
    it('should render unchecked checkbox', () => {
      const renderer = getRenderer();
      const result = renderer.checkbox({ type: 'checkbox', raw: '[ ] ', checked: false });
      assert.ok(result.includes('type="checkbox"'));
      assert.ok(result.includes('disabled=""'));
      assert.ok(!result.includes('checked'));
    });

    it('should render checked checkbox', () => {
      const renderer = getRenderer();
      const result = renderer.checkbox({ type: 'checkbox', raw: '[x] ', checked: true });
      assert.ok(result.includes('checked=""'));
      assert.ok(result.includes('disabled=""'));
      assert.ok(result.includes('type="checkbox"'));
    });
  });

  describe('paragraph', () => {
    it('should render paragraph', () => {
      const renderer = getRenderer();
      const result = renderer.paragraph({
        type: 'paragraph',
        raw: 'text',
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.strictEqual(result, '<p>text</p>\n');
    });
  });

  describe('table', () => {
    it('should render table with header and body', () => {
      const renderer = getRenderer();
      const result = renderer.table({
        type: 'table',
        raw: '| a |\n|---|\n| 1 |',
        align: [null],
        header: [
          { text: 'a', tokens: [{ type: 'text', text: 'a' }], header: true, align: null },
        ],
        rows: [
          [{ text: '1', tokens: [{ type: 'text', text: '1' }], header: false, align: null }],
        ],
      });
      assert.ok(result.includes('<table>'));
      assert.ok(result.includes('<thead>'));
      assert.ok(result.includes('<tbody>'));
      assert.ok(result.includes('<th>a</th>'));
      assert.ok(result.includes('<td>1</td>'));
      assert.ok(result.includes('</table>'));
    });

    it('should render table without tbody when no rows', () => {
      const renderer = getRenderer();
      const result = renderer.table({
        type: 'table',
        raw: '| a |\n|---|',
        align: [null],
        header: [
          { text: 'a', tokens: [{ type: 'text', text: 'a' }], header: true, align: null },
        ],
        rows: [],
      });
      assert.ok(result.includes('<table>'));
      assert.ok(result.includes('<thead>'));
      assert.ok(!result.includes('<tbody>'));
    });
  });

  describe('tablerow', () => {
    it('should render table row', () => {
      const renderer = getRenderer();
      const result = renderer.tablerow({ text: '<td>cell</td>\n' });
      assert.strictEqual(result, '<tr>\n<td>cell</td>\n</tr>\n');
    });
  });

  describe('tablecell', () => {
    it('should render th for header cell', () => {
      const renderer = getRenderer();
      const result = renderer.tablecell({
        text: 'header',
        tokens: [{ type: 'text', text: 'header' }],
        header: true,
        align: null,
      });
      assert.ok(result.startsWith('<th>'));
      assert.ok(result.endsWith('</th>\n'));
    });

    it('should render td for body cell', () => {
      const renderer = getRenderer();
      const result = renderer.tablecell({
        text: 'cell',
        tokens: [{ type: 'text', text: 'cell' }],
        header: false,
        align: null,
      });
      assert.ok(result.startsWith('<td>'));
      assert.ok(result.endsWith('</td>\n'));
    });

    it('should render aligned cell', () => {
      const renderer = getRenderer();
      const result = renderer.tablecell({
        text: 'cell',
        tokens: [{ type: 'text', text: 'cell' }],
        header: false,
        align: 'center',
      });
      assert.ok(result.includes('align="center"'));
    });
  });

  describe('strong', () => {
    it('should render strong', () => {
      const renderer = getRenderer();
      const result = renderer.strong({
        type: 'strong',
        raw: '**text**',
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.strictEqual(result, '<strong>text</strong>');
    });
  });

  describe('em', () => {
    it('should render em', () => {
      const renderer = getRenderer();
      const result = renderer.em({
        type: 'em',
        raw: '*text*',
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.strictEqual(result, '<em>text</em>');
    });
  });

  describe('codespan', () => {
    it('should render codespan', () => {
      const renderer = getRenderer();
      const result = renderer.codespan({ type: 'codespan', raw: '`code`', text: 'code' });
      assert.strictEqual(result, '<code>code</code>');
    });

    it('should escape html in codespan', () => {
      const renderer = getRenderer();
      const result = renderer.codespan({ type: 'codespan', raw: '`<div>`', text: '<div>' });
      assert.ok(result.includes('&lt;div&gt;'));
    });
  });

  describe('br', () => {
    it('should render br', () => {
      const renderer = getRenderer();
      const result = renderer.br({ type: 'br', raw: '  \n' });
      assert.strictEqual(result, '<br>');
    });
  });

  describe('del', () => {
    it('should render del', () => {
      const renderer = getRenderer();
      const result = renderer.del({
        type: 'del',
        raw: '~~text~~',
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.strictEqual(result, '<del>text</del>');
    });
  });

  describe('link', () => {
    it('should render link', () => {
      const renderer = getRenderer();
      const result = renderer.link({
        type: 'link',
        raw: '[text](https://example.com)',
        href: 'https://example.com',
        title: null,
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.ok(result.includes('<a href="https://example.com"'));
      assert.ok(result.includes('>text</a>'));
    });

    it('should render link with title', () => {
      const renderer = getRenderer();
      const result = renderer.link({
        type: 'link',
        raw: '[text](url "title")',
        href: 'https://example.com',
        title: 'title',
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.ok(result.includes('title="title"'));
    });

    it('should escape title html entities', () => {
      const renderer = getRenderer();
      const result = renderer.link({
        type: 'link',
        raw: '[text](url "a&b")',
        href: 'https://example.com',
        title: 'a&b',
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.ok(result.includes('title="a&amp;b"'));
    });

    it('should render link without title', () => {
      const renderer = getRenderer();
      const result = renderer.link({
        type: 'link',
        raw: '[text](/path)',
        href: '/path',
        title: null,
        text: 'text',
        tokens: [{ type: 'text', text: 'text' }],
      });
      assert.ok(result.includes('<a href="/path"'));
      assert.ok(!result.includes('title='));
    });
  });

  describe('image', () => {
    it('should render image', () => {
      const renderer = getRenderer();
      const result = renderer.image({
        type: 'image',
        raw: '![alt](image.png)',
        href: 'image.png',
        title: null,
        text: 'alt',
        tokens: [{ type: 'text', raw: 'alt', text: 'alt', escaped: false }],
      });
      assert.ok(result.includes('<img'));
      assert.ok(result.includes('src="image.png"'));
      assert.ok(result.includes('alt="alt"'));
    });

    it('should render image with title', () => {
      const renderer = getRenderer();
      const result = renderer.image({
        type: 'image',
        raw: '![alt](image.png "title")',
        href: 'image.png',
        title: 'title',
        text: 'alt',
        tokens: [{ type: 'text', raw: 'alt', text: 'alt', escaped: false }],
      });
      assert.ok(result.includes('title="title"'));
    });

    it('should escape alt text html entities', () => {
      const renderer = getRenderer();
      const result = renderer.image({
        type: 'image',
        raw: '![a<b](image.png)',
        href: 'image.png',
        title: null,
        text: 'a<b',
        tokens: [{ type: 'text', raw: 'a<b', text: 'a<b', escaped: false }],
      });
      assert.ok(result.includes('alt="a&lt;b"'));
    });

    it('should render image without title', () => {
      const renderer = getRenderer();
      const result = renderer.image({
        type: 'image',
        raw: '![alt](image.png)',
        href: 'image.png',
        title: null,
        text: 'alt',
        tokens: [{ type: 'text', raw: 'alt', text: 'alt', escaped: false }],
      });
      assert.ok(result.includes('<img'));
      assert.ok(!result.includes('title='));
    });
  });

  describe('text', () => {
    it('should render plain text with escaping', () => {
      const renderer = getRenderer();
      const result = renderer.text({ type: 'text', raw: 'hello', text: 'hello' });
      assert.strictEqual(result, 'hello');
    });

    it('should escape html entities in text', () => {
      const renderer = getRenderer();
      const result = renderer.text({ type: 'text', raw: '<b>bold</b>', text: '<b>bold</b>' });
      assert.ok(result.includes('&lt;b&gt;'));
    });

    it('should not escape already-escaped text', () => {
      const renderer = getRenderer();
      const result = renderer.text({ type: 'text', raw: '&gt;', text: '&gt;', escaped: true });
      assert.strictEqual(result, '&gt;');
    });

    it('should render text with inline tokens', () => {
      const renderer = getRenderer();
      const result = renderer.text({
        type: 'text',
        raw: 'hello',
        text: 'hello',
        tokens: [{ type: 'text', text: 'hello' }],
      });
      assert.strictEqual(result, 'hello');
    });
  });
});
