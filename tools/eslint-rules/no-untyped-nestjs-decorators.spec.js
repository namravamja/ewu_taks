'use strict';

const { RuleTester } = require('eslint');
const { parser } = require('typescript-eslint');
const rule = require('./no-untyped-nestjs-decorators');

// Wire RuleTester into Jest's describe/it so each case shows as a real test.
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parser } });

tester.run('no-untyped-nestjs-decorators', rule, {
  valid: [
    // Typed DTO — the happy path
    {
      name: '@Body() with a DTO class',
      code: `class UserController { create(@Body() dto: CreateUserDTO) {} }`,
    },
    {
      name: '@Query() with a DTO class',
      code: `class UserController { find(@Query() query: FindUsersDTO) {} }`,
    },
    // Scalar field extraction — @Body('field') / @Query('field') with primitive
    {
      name: '@Body() with string primitive (field extraction)',
      code: `class UserController { create(@Body() email: string) {} }`,
    },
    {
      name: '@Query() with number primitive (field extraction)',
      code: `class UserController { find(@Query() page: number) {} }`,
    },
    {
      name: '@Query() with boolean primitive',
      code: `class UserController { find(@Query() active: boolean) {} }`,
    },
    // Typed DTO array — element type is a concrete class, allowed
    {
      name: '@Body() with a DTO array',
      code: `class UserController { create(@Body() items: CreateUserDTO[]) {} }`,
    },
    // Non-guarded decorators should never trigger
    {
      name: '@Param() with no type annotation is allowed',
      code: `class UserController { find(@Param() id) {} }`,
    },
    {
      name: '@Param() with object type is allowed',
      code: `class UserController { find(@Param() params: object) {} }`,
    },
    {
      name: 'Method with no decorators is allowed',
      code: `class UserController { create(dto: any) {} }`,
    },
  ],

  invalid: [
    // ── No type annotation ───────────────────────────────────────────────────
    {
      name: '@Body() with no type annotation',
      code: `class UserController { create(@Body() dto) {} }`,
      errors: [{ messageId: 'untypedDecorator', data: { decorator: 'Body', param: 'dto' } }],
    },
    {
      name: '@Query() with no type annotation',
      code: `class UserController { find(@Query() query) {} }`,
      errors: [{ messageId: 'untypedDecorator', data: { decorator: 'Query', param: 'query' } }],
    },

    // ── any ──────────────────────────────────────────────────────────────────
    {
      name: '@Body() typed as any',
      code: `class UserController { create(@Body() dto: any) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Query() typed as any',
      code: `class UserController { find(@Query() query: any) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },

    // ── unknown ──────────────────────────────────────────────────────────────
    {
      name: '@Body() typed as unknown',
      code: `class UserController { create(@Body() dto: unknown) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Query() typed as unknown',
      code: `class UserController { find(@Query() query: unknown) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },

    // ── object / Object ───────────────────────────────────────────────────────
    {
      name: '@Body() typed as object (lowercase)',
      code: `class UserController { create(@Body() dto: object) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as Object (uppercase)',
      code: `class UserController { create(@Body() dto: Object) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },

    // ── Record<K, V> — all variants blocked (erased to Object at runtime) ────
    {
      name: '@Body() typed as Record<string, any>',
      code: `class UserController { create(@Body() dto: Record<string, any>) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as Record<string, unknown>',
      code: `class UserController { create(@Body() dto: Record<string, unknown>) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as Record<string, string> (concrete value type still erased at runtime)',
      code: `class UserController { create(@Body() dto: Record<string, string>) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },

    // ── Array of unsafe type — erased to Array at runtime ────────────────────
    {
      name: '@Body() typed as any[]',
      code: `class UserController { create(@Body() dto: any[]) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as unknown[]',
      code: `class UserController { create(@Body() dto: unknown[]) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Query() typed as any[]',
      code: `class UserController { find(@Query() items: any[]) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as any[][] (nested array)',
      code: `class UserController { create(@Body() dto: any[][]) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },

    // ── Union / Intersection with unsafe member ───────────────────────────────
    {
      name: '@Body() typed as CreateDTO | any',
      code: `class UserController { create(@Body() dto: CreateDTO | any) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as CreateDTO | unknown',
      code: `class UserController { create(@Body() dto: CreateDTO | unknown) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },
    {
      name: '@Body() typed as CreateDTO & Record<string, any>',
      code: `class UserController { create(@Body() dto: CreateDTO & Record<string, any>) {} }`,
      errors: [{ messageId: 'untypedDecorator' }],
    },

    // ── Multiple invalid params in one method ─────────────────────────────────
    {
      name: 'Both @Body() and @Query() untyped in same method',
      code: `class UserController { create(@Body() dto: any, @Query() query: unknown) {} }`,
      errors: [
        { messageId: 'untypedDecorator', data: { decorator: 'Body', param: 'dto' } },
        { messageId: 'untypedDecorator', data: { decorator: 'Query', param: 'query' } },
      ],
    },
  ],
});
