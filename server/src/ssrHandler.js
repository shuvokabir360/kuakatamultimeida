import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';

let ssrHandler = null;

export async function initSSR() {
  try {
    const ssrPath = path.resolve('.output/server/_ssr/ssr.mjs');
    if (fs.existsSync(ssrPath)) {
      const fileUrl = pathToFileURL(ssrPath).href;
      const mod = await import(fileUrl);
      ssrHandler = mod.default || mod;
      console.log('✅ [TanStack SSR]: In-process renderer loaded successfully');
      return true;
    } else {
      console.warn('⚠️ [TanStack SSR]: ssr.mjs not found at', ssrPath);
    }
  } catch (err) {
    console.warn('⚠️ [TanStack SSR Load Warning]:', err.message);
  }
  return false;
}

export async function handleSSR(req, res, next) {
  if (!ssrHandler || typeof ssrHandler.fetch !== 'function') {
    return next();
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.originalUrl || req.url, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        body = JSON.stringify(req.body);
        headers.set('content-type', 'application/json');
      } else if (req.body && typeof req.body === 'string') {
        body = req.body;
      }
    }

    const webReq = new Request(url.href, {
      method: req.method,
      headers,
      body,
    });

    const webRes = await ssrHandler.fetch(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((val, key) => {
      // Don't set content-encoding or transfer-encoding directly as Express manages it
      if (key !== 'content-encoding' && key !== 'transfer-encoding') {
        res.setHeader(key, val);
      }
    });

    if (webRes.body) {
      const reader = webRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const text = await webRes.text();
      res.send(text);
    }
  } catch (err) {
    console.error('SSR render error:', err);
    next();
  }
}
