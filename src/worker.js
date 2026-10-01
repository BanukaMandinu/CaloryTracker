// Worker entry: static files are served by the assets binding; only /api/* reaches this code.
// The API logic is shared with the Pages Functions version in functions/api/[[route]].js.
import { onRequest } from '../functions/api/[[route]].js';

export default {
  async fetch(request, env) {
    const route = new URL(request.url).pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    return onRequest({ request, env, params: { route } });
  },
};
