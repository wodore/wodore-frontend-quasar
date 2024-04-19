import createClient from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';

export type schemasWodore = compWodore['schemas'];

export const clientWodore = createClient<pathsWodore>({
  baseUrl: 'https://api.wodore.com',
});
