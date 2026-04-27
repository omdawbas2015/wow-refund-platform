import { NextResponse } from 'next/server';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  loginSchema,
  signupSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  setPasswordSchema,
} from '@wow/validators';

export const dynamic = 'force-dynamic';

/**
 * OpenAPI 3.1 document generated at runtime from the project's zod
 * validators. Currently scoped to the public auth surface and the
 * health probe — the export endpoints and Power Automate webhook are
 * authenticated and shaped server-side, so they're listed but their
 * request/response bodies are described loosely until per-endpoint
 * schemas exist.
 *
 * The doc is regenerated per request (no caching) so schema edits in
 * @wow/validators show up immediately. Cost is negligible because
 * zodToJsonSchema is pure-CPU and the schemas are tiny.
 *
 * Hit: GET /api/openapi
 * Useful with Swagger UI / Redoc / Stoplight: load
 *   https://<host>/api/openapi
 */

function schemaFor<T>(s: T) {
  return zodToJsonSchema(s as never, { target: 'openApi3' });
}

export async function GET() {
  const doc = {
    openapi: '3.1.0',
    info: {
      title: 'WOW Refund API',
      version: '1.0.0',
      description:
        'Enterprise refund management platform. Public surfaces only — internal trpc routers are intentionally excluded.',
    },
    servers: [{ url: '/' }],
    components: {
      schemas: {
        LoginInput: schemaFor(loginSchema),
        SignupInput: schemaFor(signupSchema),
        ForgotPasswordRequestInput: schemaFor(forgotPasswordRequestSchema),
        ForgotPasswordVerifyInput: schemaFor(forgotPasswordVerifySchema),
        SetPasswordInput: schemaFor(setPasswordSchema),
        ActionResult: {
          oneOf: [
            {
              type: 'object',
              required: ['ok'],
              properties: {
                ok: { type: 'boolean', enum: [true] },
                message: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['ok', 'error'],
              properties: {
                ok: { type: 'boolean', enum: [false] },
                error: { type: 'string' },
                fieldErrors: {
                  type: 'object',
                  additionalProperties: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          ],
        },
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded'] },
            uptimeMs: { type: 'integer' },
            version: { type: 'string' },
            db: { type: 'string', enum: ['ok', 'error'] },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          summary: 'Liveness + readiness probe',
          tags: ['system'],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Health' },
                },
              },
            },
            '503': { description: 'Service degraded (DB unreachable, etc.)' },
          },
        },
      },
      '/api/auth/[...nextauth]': {
        post: {
          summary: 'NextAuth credentials sign-in',
          tags: ['auth'],
          requestBody: {
            required: true,
            content: {
              'application/x-www-form-urlencoded': {
                schema: { $ref: '#/components/schemas/LoginInput' },
              },
            },
          },
          responses: {
            '200': { description: 'Session cookie issued' },
            '302': { description: 'Redirect to error page on failure' },
            '429': { description: 'Rate limited (5 attempts / 5 min / IP)' },
          },
        },
      },
      '/api/openapi': {
        get: {
          summary: 'This document',
          tags: ['system'],
          responses: {
            '200': {
              description: 'OpenAPI 3.1 description of the public API',
              content: { 'application/json': {} },
            },
          },
        },
      },
      '/api/webhooks/power-automate': {
        post: {
          summary: 'Power Automate inbound webhook (HMAC-signed)',
          tags: ['webhooks'],
          description:
            'Receives reply emails from the Power Automate flow. Requires `x-pa-signature` header (HMAC-SHA256 over body, shared secret in POWER_AUTOMATE_SIGNING_SECRET).',
          responses: {
            '200': { description: 'Webhook accepted' },
            '401': { description: 'Bad signature or missing header' },
          },
        },
      },
    },
    tags: [
      { name: 'system', description: 'Operational endpoints' },
      { name: 'auth', description: 'Authentication and account management' },
      { name: 'webhooks', description: 'Inbound webhooks from Power Automate' },
    ],
  };

  return NextResponse.json(doc, {
    headers: { 'cache-control': 'public, max-age=60' },
  });
}
