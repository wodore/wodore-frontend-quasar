# API clients

`wodore_v1.d.ts` is generated from the backend OpenAPI schema
(`yarn gen:api-local` against a running backend, or `yarn gen:api`
against production). Never edit it by hand.

## Sparse fieldsets (`fields[TYPE]`)

Since API version `2026-10-02` the fieldset endpoints (huts detail,
organizations, symbols) accept JSON:API sparse fieldsets:
`?fields[huts]=slug,name,elevation`. OpenAPI cannot express
query-dependent response shapes, so the generated types describe the
full schema; narrow them with `Sparse` from `@clients/index`:

```ts
import { clientWodore, Sparse, schemasWodore } from '@clients/index';

type HutCard = Sparse<schemasWodore['HutSchemaDetails'], 'slug' | 'name' | 'elevation'>;

const { data } = await clientWodore.GET('/v1/huts/{slug}', {
  params: { path: { slug }, query: { fields: { huts: 'slug,name,elevation' } } },
});
// data is the full type; cast the narrowed view where consumed:
const card = data as unknown as HutCard; // or narrow field-by-field
```

The keys are compile-time checked — renaming a backend field breaks the
build here instead of silently mismatching at runtime.
