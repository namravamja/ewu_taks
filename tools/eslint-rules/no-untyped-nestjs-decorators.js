'use strict';

/**
 * ESLint rule: no-untyped-nestjs-decorators
 *
 * Enforces that every @Body() and @Query() parameter in NestJS controllers has
 * an explicit DTO class type annotation — not `any`, `unknown`, `object`,
 * `Object`, any `Record<K, V>` (TypeScript erases these to Object at runtime,
 * so class-validator never runs), a union/intersection containing any of the
 * above, or no annotation at all. Without a concrete class, class-validator
 * cannot run, leaving Prisma exposed to operator injection attacks.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const GUARDED_DECORATORS = new Set(['Body', 'Query']);

/**
 * Returns true when an inner TSESTree type node is unsafe:
 * `any`, `unknown`, `object`, `Object`, `Record<string, any>`,
 * `Record<string, unknown>`, `any[]`, `unknown[]` (or deeper nested arrays),
 * or any union/intersection that contains one of the above.
 *
 * Keeping this as a separate function from isUnsafeType allows union/
 * intersection members to be checked recursively without re-wrapping in a
 * fake TSTypeAnnotation node.
 *
 * @param {import('@typescript-eslint/types').TSESTree.TypeNode | undefined} type
 */
function isUnsafeTypeNode(type) {
  if (!type) return true;

  switch (type.type) {
    case 'TSAnyKeyword':
      return true;
    case 'TSUnknownKeyword':
      // `unknown` bypasses class-validator — no DTO class means no validation
      return true;
    case 'TSObjectKeyword':
      return true;
    case 'TSArrayType':
      // `any[]`, `unknown[]`, `any[][]`, etc. — TypeScript erases these to
      // Array at runtime (not Object), so class-validator never runs.
      // Check the element type recursively to handle arbitrarily deep nesting.
      return isUnsafeTypeNode(type.elementType);
    case 'TSUnionType':
    case 'TSIntersectionType':
      // Unsafe if ANY member is unsafe (e.g. `CreateDTO | any`)
      return type.types.some(isUnsafeTypeNode);
    case 'TSTypeReference': {
      const name = type.typeName.type === 'Identifier' ? type.typeName.name : null;

      if (name === 'Object') return true;

      // Record<K, V> — TypeScript erases ALL Record types to Object at runtime,
      // so class-validator can never run regardless of the value type.
      if (name === 'Record') return true;

      return false;
    }
    default:
      return false;
  }
}

/**
 * Returns true when the TypeScript type annotation is unsafe.
 *
 * @param {import('@typescript-eslint/types').TSESTree.TSTypeAnnotation | undefined} typeAnnotation
 */
function isUnsafeType(typeAnnotation) {
  if (!typeAnnotation) return true;
  return isUnsafeTypeNode(typeAnnotation.typeAnnotation);
}

/**
 * Returns the name of the first @Body() or @Query() decorator on the node,
 * or null if neither is present.
 *
 * @param {import('@typescript-eslint/types').TSESTree.Parameter} param
 */
function getGuardedDecoratorName(param) {
  if (!param.decorators) return null;

  for (const decorator of param.decorators) {
    const expr = decorator.expression;
    if (
      expr.type === 'CallExpression' &&
      expr.callee.type === 'Identifier' &&
      GUARDED_DECORATORS.has(expr.callee.name)
    ) {
      return expr.callee.name;
    }
  }

  return null;
}

/**
 * Checks all parameters of a function node and reports any that have an
 * unsafe type annotation on a guarded decorator.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('@typescript-eslint/types').TSESTree.Parameter[]} params
 */
function checkParams(context, params) {
  for (const param of params) {
    const decoratorName = getGuardedDecoratorName(param);
    if (!decoratorName) continue;

    if (isUnsafeType(param.typeAnnotation)) {
      const paramName = param.type === 'Identifier' ? param.name : '<param>';

      context.report({
        node: param,
        messageId: 'untypedDecorator',
        data: { decorator: decoratorName, param: paramName },
      });
    }
  }
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a typed DTO class on @Body() and @Query() parameters to prevent Prisma operator injection',
      recommended: true,
    },
    messages: {
      untypedDecorator:
        '@{{decorator}}() parameter "{{param}}" must have a typed DTO class ' +
        '(not any / unknown / object / Object / any[] / unknown[] / Record<K,V> / union-with-any / untyped). ' +
        'Without a concrete class, class-validator cannot run and Prisma is exposed to operator injection.',
    },
    schema: [],
  },

  create(context) {
    return {
      FunctionDeclaration(node) {
        checkParams(context, node.params);
      },
      FunctionExpression(node) {
        checkParams(context, node.params);
      },
      ArrowFunctionExpression(node) {
        checkParams(context, node.params);
      },
    };
  },
};
