import { Hono, Context } from 'hono'
import { Ai } from '@cloudflare/ai';

import indexHtml from './public/index.html';

type Bindings = {
	AI: Ai
  R2: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c: Context) => {
  c.header('Content-Type', 'text/html')
  return c.body(indexHtml);
});

app.post('/', async (c: Context) => {
	const body = await c.req.json();
	const ai = new Ai(c.env.AI);

  const inputs = {
    prompt: body.prompt
  };

	let response: Uint8Array = new Uint8Array();

  try {
    response = await ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', inputs);
  } catch (error) {
    return c.json({ error: "An error occurred" }, 500);
  }
  const key: string = c.req.header('cf-ray') + '.png';

  c.executionCtx.waitUntil(c.env.R2.put(key, response));

	c.header('Content-Type', 'image/png')
	return c.body(response);
});

export default app;
