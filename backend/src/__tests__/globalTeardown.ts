import { closePool } from '../db';

export default async function globalTeardown() {
  await closePool();
}