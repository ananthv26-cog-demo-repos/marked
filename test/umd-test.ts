import '../lib/marked.umd.js';

declare const marked: typeof import('marked').marked;

if (!(marked.parse('# test') as string).includes('<h1')) {
  throw new Error('Invalid markdown');
}
