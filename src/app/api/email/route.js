import { createHttpMethods } from '@/lib/http-methods-factory';

export const { GET, POST, PUT, PATCH, DELETE } = createHttpMethods('email');
