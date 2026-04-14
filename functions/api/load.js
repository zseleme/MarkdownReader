'use strict';

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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8',
    };
    if (ALLOWED_ORIGINS.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

function extractDocumentId(docParam) {
    if (docParam.includes('-')) {
        const parts = docParam.split('-');
        return parts[parts.length - 1];
    }
    return docParam;
}

function isValidDocumentId(id) {
    return /^[a-z0-9]{8}$/.test(id);
}

export async function onRequestOptions({ request }) {
    const origin = request.headers.get('Origin') || '';
    return new Response(null, { status: 200, headers: corsHeaders(origin) });
}

export async function onRequestGet({ request, env }) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    const url = new URL(request.url);
    const docParam = url.searchParams.get('id');

    if (!docParam) {
        return new Response(
            JSON.stringify({ success: false, error: 'No document ID provided' }),
            { status: 400, headers }
        );
    }

    const id = extractDocumentId(docParam);

    if (!isValidDocumentId(id)) {
        return new Response(
            JSON.stringify({ success: false, error: 'Invalid document ID format' }),
            { status: 400, headers }
        );
    }

    try {
        const [content, metaRaw] = await Promise.all([
            env.DOCUMENTS.get(`doc:${id}:content`),
            env.DOCUMENTS.get(`doc:${id}:meta`),
        ]);

        if (content === null) {
            return new Response(
                JSON.stringify({ success: false, error: 'Document not found' }),
                { status: 404, headers }
            );
        }

        const metadata = metaRaw ? JSON.parse(metaRaw) : {};

        return new Response(
            JSON.stringify({
                success: true,
                id,
                content,
                title: metadata.title || 'Untitled',
                created: metadata.created || null,
                size: content.length,
            }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Load API Error:', error.message, '- ID:', id);
        return new Response(
            JSON.stringify({ success: false, error: 'Internal server error' }),
            { status: 500, headers }
        );
    }
}
