import { IS_PUBLIC_KEY } from '@mediastar/core';
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

interface OperationLike {
  security?: Record<string, string[]>[];
}

const REQUEST_METHOD_MAP: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.OPTIONS]: 'options',
  [RequestMethod.HEAD]: 'head',
};

/**
 * Strips the global Bearer-auth security requirement from every OpenAPI
 * operation whose NestJS handler (or controller) is decorated with `@Public()`.
 *
 * Call after `SwaggerModule.createDocument()` and before `SwaggerModule.setup()`.
 */
export function stripPublicSecurity(
  app: INestApplication,
  document: OpenAPIObject,
  globalPrefix: string,
): void {
  const publicPaths = collectPublicPaths(app, globalPrefix);

  for (const { path, method } of publicPaths) {
    const pathItem = document.paths[path]; // eslint-disable-line security/detect-object-injection
    if (!pathItem) continue;

    const operation = pathItem[method] as OperationLike | undefined; // eslint-disable-line security/detect-object-injection
    if (operation) {
      operation.security = (operation.security ?? []).filter(
        (scheme) => !('access-token' in scheme),
      );
    }
  }
}

/**
 * Swagger UI **response** interceptor.
 *
 * After any successful auth endpoint response, reads the access-token cookie
 * (env-aware name) and auto-authorizes the Bearer scheme so subsequent
 * Swagger requests include `Authorization: Bearer <token>`.
 *
 * Cookie names checked (in order):
 *   - Production: `__Secure-ewu.at`
 *   - Staging:    `__Secure-ewu.stage.at`
 *   - Dev:        `ewu_at`
 *
 * **Note:** This function is serialized via `.toString()` and injected into
 * the Swagger UI HTML page — all helpers must be inlined (no external refs).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Swagger UI responseInterceptor signature requires `any`
export function swaggerResponseInterceptor(response: any): any {
  const authPaths = [
    '/api/auth/login',
    '/api/auth/2fa/verify',
    '/api/auth/refresh',
    '/api/auth/sessions/resolve-conflict',
  ];

  if (response.ok && authPaths.some((p: string) => response.url?.includes(p))) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- browser-only: document not typed in Node
    const cookies: string = (globalThis as any).document?.cookie ?? '';

    // Read the access-token cookie (prod → staging → dev)
    const atMatch =
      /(?:^|;\s*)__Secure-ewu\.at=([^;]*)/.exec(cookies) ??
      /(?:^|;\s*)__Secure-ewu\.stage\.at=([^;]*)/.exec(cookies) ??
      /(?:^|;\s*)ewu_at=([^;]*)/.exec(cookies);
    if (atMatch) {
      (
        globalThis as unknown as { ui?: { authActions: { authorize(a: unknown): void } } }
      ).ui?.authActions?.authorize({
        'access-token': {
          name: 'access-token',
          schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          value: decodeURIComponent(atMatch[1]),
        },
      });
    }
  }
  return response;
}

interface PublicRoute {
  path: string;
  method: HttpMethod;
}

function collectPublicPaths(app: INestApplication, globalPrefix: string): PublicRoute[] {
  const routes: PublicRoute[] = [];
  const modulesContainer = app.get(ModulesContainer);

  for (const [, nestModule] of modulesContainer) {
    for (const [, wrapper] of nestModule.controllers) {
      const metatype = wrapper.metatype as (new (...args: never[]) => unknown) | null;
      if (!metatype) continue;

      const isClassPublic = Reflect.getMetadata(IS_PUBLIC_KEY, metatype) === true;
      const controllerPath: string = Reflect.getMetadata(PATH_METADATA, metatype) ?? '';

      routes.push(...collectPublicMethods(metatype, isClassPublic, globalPrefix, controllerPath));
    }
  }

  return routes;
}

function collectPublicMethods(
  metatype: new (...args: never[]) => unknown,
  isClassPublic: boolean,
  globalPrefix: string,
  controllerPath: string,
): PublicRoute[] {
  const routes: PublicRoute[] = [];
  const prototype = metatype.prototype as Record<string, unknown>;

  for (const key of Object.getOwnPropertyNames(prototype)) {
    if (key === 'constructor') continue;

    const handler = prototype[key]; // eslint-disable-line security/detect-object-injection
    if (typeof handler !== 'function') continue;

    const route = resolvePublicRoute(handler, isClassPublic, globalPrefix, controllerPath);
    if (route) routes.push(route);
  }

  return routes;
}

function resolvePublicRoute(
  handler: object,
  isClassPublic: boolean,
  globalPrefix: string,
  controllerPath: string,
): PublicRoute | null {
  const requestMethod: RequestMethod | undefined = Reflect.getMetadata(METHOD_METADATA, handler);
  if (requestMethod === undefined) return null;

  const isPublic = isClassPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
  if (!isPublic) return null;

  const httpMethod = REQUEST_METHOD_MAP[requestMethod]; // eslint-disable-line security/detect-object-injection
  if (!httpMethod) return null;

  const methodPath: string = Reflect.getMetadata(PATH_METADATA, handler) ?? '';

  return { path: toOpenApiPath(globalPrefix, controllerPath, methodPath), method: httpMethod };
}

function toOpenApiPath(...segments: string[]): string {
  const raw = segments.filter(Boolean).join('/');
  const normalized = raw.replace(/\/{2,}/g, '/');
  const parameterized = normalized.replace(/:(\w+)/g, '{$1}');

  return '/' + parameterized.replace(/^\/|\/$/g, '');
}
