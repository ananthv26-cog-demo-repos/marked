import {
  escapeHtmlEntities,
  cleanUrl,
  splitCells,
  rtrim,
  trimTrailingBlankLines,
  findClosingBracket,
  expandTabs,
} from '../../src/helpers.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('helpers', () => {
  describe('escapeHtmlEntities', () => {
    it('should escape ampersand', () => {
      assert.strictEqual(escapeHtmlEntities('&', true), '&amp;');
    });

    it('should escape less than', () => {
      assert.strictEqual(escapeHtmlEntities('<', true), '&lt;');
    });

    it('should escape greater than', () => {
      assert.strictEqual(escapeHtmlEntities('>', true), '&gt;');
    });

    it('should escape double quote', () => {
      assert.strictEqual(escapeHtmlEntities('"', true), '&quot;');
    });

    it('should escape single quote', () => {
      assert.strictEqual(escapeHtmlEntities("'", true), '&#39;');
    });

    it('should escape multiple entities', () => {
      assert.strictEqual(escapeHtmlEntities('<div class="test">&</div>', true), '&lt;div class=&quot;test&quot;&gt;&amp;&lt;/div&gt;');
    });

    it('should return string unchanged when no entities to escape', () => {
      assert.strictEqual(escapeHtmlEntities('hello world', true), 'hello world');
    });

    it('should handle empty string', () => {
      assert.strictEqual(escapeHtmlEntities('', true), '');
    });

    it('should escape without encode flag (no quotes)', () => {
      assert.strictEqual(escapeHtmlEntities('&'), '&amp;');
      assert.strictEqual(escapeHtmlEntities('<'), '&lt;');
      assert.strictEqual(escapeHtmlEntities('>'), '&gt;');
    });

    it('should also escape quotes without encode flag', () => {
      assert.strictEqual(escapeHtmlEntities('"'), '&quot;');
      assert.strictEqual(escapeHtmlEntities("'"), '&#39;');
    });
  });

  describe('cleanUrl', () => {
    it('should return encoded url', () => {
      const result = cleanUrl('https://example.com');
      assert.strictEqual(result, 'https://example.com');
    });

    it('should encode spaces in url', () => {
      const result = cleanUrl('https://example.com/path with spaces');
      assert.ok(result.includes('path%20with%20spaces'));
    });

    it('should handle already encoded urls', () => {
      const result = cleanUrl('https://example.com/path%20encoded');
      assert.ok(result);
      assert.ok(result.includes('path'));
    });

    it('should encode special characters in url', () => {
      const result = cleanUrl('https://example.com/path?a=1&b=2');
      assert.ok(result);
      assert.ok(typeof result === 'string');
    });

    it('should handle relative urls', () => {
      const result = cleanUrl('/path/to/page');
      assert.strictEqual(result, '/path/to/page');
    });

    it('should handle hash urls', () => {
      const result = cleanUrl('#section');
      assert.strictEqual(result, '#section');
    });

    it('should handle empty string', () => {
      const result = cleanUrl('');
      assert.strictEqual(result, '');
    });

    it('should handle unicode in urls', () => {
      const result = cleanUrl('https://example.com/日本語');
      assert.ok(result);
      assert.ok(typeof result === 'string');
    });
  });

  describe('splitCells', () => {
    it('should split pipe-delimited cells', () => {
      const result = splitCells('| a | b | c |');
      assert.deepEqual(result, ['a', 'b', 'c']);
    });

    it('should split cells without leading/trailing pipes', () => {
      const result = splitCells('a | b | c');
      assert.deepEqual(result, ['a', 'b', 'c']);
    });

    it('should handle escaped pipes', () => {
      const result = splitCells('a \\| b | c');
      assert.deepEqual(result, ['a | b', 'c']);
    });

    it('should trim whitespace from cells', () => {
      const result = splitCells('|  a  |  b  |');
      assert.deepEqual(result, ['a', 'b']);
    });

    it('should limit cells to count', () => {
      const result = splitCells('| a | b | c | d |', 2);
      assert.deepEqual(result, ['a', 'b']);
    });

    it('should pad cells to count with empty strings', () => {
      const result = splitCells('| a |', 3);
      assert.deepEqual(result, ['a', '', '']);
    });

    it('should handle single empty cell', () => {
      const result = splitCells('|  |');
      assert.deepEqual(result, ['']);
    });

    it('should handle single cell', () => {
      const result = splitCells('| cell |');
      assert.deepEqual(result, ['cell']);
    });
  });

  describe('rtrim', () => {
    it('should remove trailing characters', () => {
      assert.strictEqual(rtrim('hello###', '#'), 'hello');
    });

    it('should return empty string for empty input', () => {
      assert.strictEqual(rtrim('', '#'), '');
    });

    it('should return unchanged string when no trailing match', () => {
      assert.strictEqual(rtrim('hello', '#'), 'hello');
    });

    it('should remove all characters if entire string matches', () => {
      assert.strictEqual(rtrim('###', '#'), '');
    });

    it('should remove trailing newlines', () => {
      assert.strictEqual(rtrim('text\n\n\n', '\n'), 'text');
    });

    it('should remove trailing non-matching chars when inverted', () => {
      assert.strictEqual(rtrim('hello###', '#', true), 'hello###');
    });

    it('should handle invert removing non-matching suffix', () => {
      assert.strictEqual(rtrim('###hello', '#', true), '###');
    });

    it('should handle single character string', () => {
      assert.strictEqual(rtrim('#', '#'), '');
    });

    it('should handle single character string that does not match', () => {
      assert.strictEqual(rtrim('a', '#'), 'a');
    });
  });

  describe('trimTrailingBlankLines', () => {
    it('should keep single trailing blank line', () => {
      const result = trimTrailingBlankLines('text\n');
      assert.strictEqual(result, 'text\n');
    });

    it('should trim when more than one trailing blank line', () => {
      const result = trimTrailingBlankLines('text\n\n');
      assert.strictEqual(result, 'text');
    });

    it('should trim excess trailing blank lines', () => {
      const result = trimTrailingBlankLines('text\n\n\n\n');
      assert.strictEqual(result, 'text');
    });

    it('should handle text with no trailing newline', () => {
      const result = trimTrailingBlankLines('text');
      assert.strictEqual(result, 'text');
    });

    it('should handle multi-line text', () => {
      const result = trimTrailingBlankLines('line1\nline2\n\n\n\n');
      assert.strictEqual(result, 'line1\nline2');
    });

    it('should handle whitespace-only trailing lines', () => {
      const result = trimTrailingBlankLines('text\n   \n  \n \n');
      assert.strictEqual(result, 'text');
    });
  });

  describe('findClosingBracket', () => {
    it('should return -1 for balanced parentheses', () => {
      assert.strictEqual(findClosingBracket('(content)', '()'), -1);
    });

    it('should return -1 when no closing bracket present', () => {
      assert.strictEqual(findClosingBracket('no bracket here', '()'), -1);
    });

    it('should return -1 for balanced nested brackets', () => {
      assert.strictEqual(findClosingBracket('(a(b)c)', '()'), -1);
    });

    it('should find unmatched closing bracket', () => {
      assert.strictEqual(findClosingBracket('content)', '()'), 7);
    });

    it('should find unmatched closing after balanced pair', () => {
      assert.strictEqual(findClosingBracket('(a)b)', '()'), 4);
    });

    it('should return -1 for empty string', () => {
      assert.strictEqual(findClosingBracket('', '()'), -1);
    });

    it('should return -1 for balanced square brackets', () => {
      assert.strictEqual(findClosingBracket('[content]', '[]'), -1);
    });

    it('should find unmatched closing square bracket', () => {
      assert.strictEqual(findClosingBracket('content]', '[]'), 7);
    });

    it('should return -2 when more open brackets than closed', () => {
      assert.strictEqual(findClosingBracket('((content)', '()'), -2);
    });

    it('should skip escaped brackets', () => {
      assert.strictEqual(findClosingBracket('a\\)b)', '()'), 4);
    });

    it('should return -1 for deeply nested balanced brackets', () => {
      assert.strictEqual(findClosingBracket('(a(b(c)d)e)', '()'), -1);
    });
  });

  describe('expandTabs', () => {
    it('should expand tab to spaces', () => {
      const result = expandTabs('\ttext');
      assert.strictEqual(result, '    text');
    });

    it('should handle string without tabs', () => {
      const result = expandTabs('no tabs');
      assert.strictEqual(result, 'no tabs');
    });

    it('should handle empty string', () => {
      const result = expandTabs('');
      assert.strictEqual(result, '');
    });

    it('should expand tabs with custom indent', () => {
      const result = expandTabs('\ttext', 2);
      assert.strictEqual(result, '  text');
    });

    it('should handle multiple tabs', () => {
      const result = expandTabs('\t\ttext');
      assert.strictEqual(result, '        text');
    });

    it('should handle tab after some characters', () => {
      const result = expandTabs('ab\ttext');
      assert.strictEqual(result, 'ab  text');
    });

    it('should align tabs to 4-space boundaries', () => {
      const result = expandTabs('a\tb');
      assert.strictEqual(result, 'a   b');
    });

    it('should handle tab at 4-char boundary', () => {
      const result = expandTabs('abcd\te');
      assert.strictEqual(result, 'abcd    e');
    });
  });
});
