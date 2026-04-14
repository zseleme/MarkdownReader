'use strict';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const RATE_LIMIT = 10;
const RATE_WINDOW = 3600; // 1 hour in seconds

const ALLOWED_ORIGINS = [
    'http://localhost:8000',
    'http://localhost:3000',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:3000',
    'https://zaiden.eng.br',
    'https://md.zaiden.eng.br',
    'https://md-dev.zaiden.eng.br',
];

function corsHeaders(origin) {
    const headers = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8',
    };
    if (ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

async function checkRateLimit(env, ip) {
    const key = `ratelimit:${ip}`;
    const raw = await env.DOCUMENTS.get(key);
    const now = Math.floor(Date.now() / 1000);

    let data = raw ? JSON.parse(raw) : null;

    if (data && (now - data.timestamp) < RATE_WINDOW) {
        if (data.count >= RATE_LIMIT) return false;
        data.count++;
    } else {
        data = { timestamp: now, count: 1 };
    }

    await env.DOCUMENTS.put(key, JSON.stringify(data), { expirationTtl: RATE_WINDOW });
    return true;
}

function generateShortId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function createSlug(title) {
    const slug = title
        .toLowerCase()
        .replace(/\.md$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
    return slug === 'untitled' ? '' : slug;
}

export async function onRequestOptions({ request }) {
    const origin = request.headers.get('Origin') || '';
    return new Response(null, { status: 200, headers: corsHeaders(origin) });
}

export async function onRequestPost({ request, env }) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    try {
        const allowed = await checkRateLimit(env, ip);
        if (!allowed) {
            return new Response(
                JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
                { status: 429, headers }
            );
        }

        const body = await request.json();

        if (!body.content || typeof body.content !== 'string') {
            return new Response(
                JSON.stringify({ success: false, error: 'No content provided' }),
                { status: 400, headers }
            );
        }

        if (body.content.length > MAX_FILE_SIZE) {
            return new Response(
                JSON.stringify({ success: false, error: 'Content exceeds maximum size of 5MB' }),
                { status: 400, headers }
            );
        }

        const title = (body.title || 'Untitled')
            .replace(/<[^>]*>/g, '')
            .trim()
            .substring(0, 255) || 'Untitled';

        const id = generateShortId();
        const slug = createSlug(title);

        const metadata = {
            id,
            slug,
            title,
            created: new Date().toISOString(),
            size: body.content.length,
        };

        await Promise.all([
            env.DOCUMENTS.put(`doc:${id}:content`, body.content),
            env.DOCUMENTS.put(`doc:${id}:meta`, JSON.stringify(metadata)),
        ]);

        const docParam = slug ? `${slug}-${id}` : id;
        const reqUrl = new URL(request.url);
        const shareUrl = `${reqUrl.protocol}//${reqUrl.host}?doc=${docParam}`;

        return new Response(
            JSON.stringify({ success: true, id, slug, title, created: metadata.created, url: shareUrl }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Save API Error:', error.message, '- IP:', ip);
        return new Response(
            JSON.stringify({ success: false, error: 'Internal server error' }),
            { status: 500, headers }
        );
    }
}
