import zlib from 'zlib';

const COMPRESSION_THRESHOLD = 1024; // Only compress files >1KB

export function compress(content, acceptEncoding = '') {
  const size = Buffer.byteLength(content, 'utf-8');
  if (size < COMPRESSION_THRESHOLD) return { content, encoding: null };
  
  const ae = acceptEncoding.toLowerCase();
  
  if (ae.includes('br')) {
    const compressed = zlib.brotliCompressSync(content, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: size
      }
    });
    return { content: compressed, encoding: 'br' };
  }
  
  if (ae.includes('gzip')) {
    const compressed = zlib.gzipSync(content, { level: 6 });
    return { content: compressed, encoding: 'gzip' };
  }
  
  return { content, encoding: null };
}

export function getCacheHeaders(type, maxAge = 86400) {
  if (type === 'static') {
    return {
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
      'Expires': new Date(Date.now() + maxAge * 1000).toUTCString()
    };
  }
  if (type === 'dynamic') {
    return {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }
  return {};
}
