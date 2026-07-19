export type ApiKeyMeta = {
  id: string;
  prefix: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number | null;
};
