import { marked } from 'marked';
import pkg from '../package.json' with { type: 'json' };

const version = pkg.version;
const name = 'Marked';

interface DingusRequest {
  method?: string;
  query: Record<string, string | undefined>;
}

interface DingusResponse {
  status: (statusCode: number) => DingusResponse;
  json: (body: unknown) => void;
}

export default function dingus(req: DingusRequest, res: DingusResponse): void {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: {
        code: 'method_not_allowed',
        message: 'Only GET requests are supported for this endpoint.',
      },
    });
  }
  const { text = '' } = req.query;
  const html = marked(text);
  res.json({ name, version, html });
}
