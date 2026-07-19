/** Upload a batch of files; 409 duplicates are skipped so the rest still import. */
export async function importMediaBatch(
  files: File[],
  importOne: (file: File) => Promise<Response>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      const res = await importOne(file);
      const data = (await res.json()) as {
        error?: string;
        duplicate?: boolean;
      };
      if (res.status === 409 || data.duplicate) {
        skipped += 1;
        continue;
      }
      if (!res.ok) {
        errors.push(data.error ?? `Failed to import ${file.name}`);
        continue;
      }
      imported += 1;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { imported, skipped, errors };
}
