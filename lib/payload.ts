/**
 * Compat shim — la couche données réelle est lib/data.ts (Payload débranché).
 */
export { find, findGlobal, findByID } from './data';

const emptyFindResult = () => ({
  docs: [],
  totalDocs: 0,
  totalPages: 0,
  page: 1,
  limit: 10,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
});

export const getPayloadClient = async () => ({
  find: async (_args: any) => emptyFindResult(),
  findGlobal: async (_args: any) => ({}),
  findByID: async (_args: any) => null,
  count: async (_args: any) => ({ totalDocs: 0 }),
  update: async (_args: any) => ({}),
  delete: async (_args: any) => ({}),
});
