import type { ParagraphePredefini } from '../../types/domain';
import { requestJson } from './utils';

type ParagrapheRow = {
  id: number;
  id_modele: number | null;
  ordre: number | null;
  titre: string | null;
  categorie: string | null;
  contenu: string;
};

function mapRow(row: ParagrapheRow): ParagraphePredefini {
  return {
    id: row.id,
    idModele: row.id_modele,
    ordre: row.ordre,
    titre: row.titre ?? null,
    categorie: row.categorie ?? null,
    contenu: row.contenu,
  };
}

export async function getParagraphes(options: { modeleId?: number; categorie?: string } = {}): Promise<ParagraphePredefini[]> {
  const params = new URLSearchParams();
  if (options.modeleId != null) params.set('modeleId', String(options.modeleId));
  if (options.categorie != null) params.set('categorie', options.categorie);
  const qs = params.size > 0 ? `?${params.toString()}` : '';
  const rows = await requestJson<ParagrapheRow[]>(`/api/paragraphes${qs}`);
  return rows.map(mapRow);
}

export async function getParagrapheCategories(): Promise<string[]> {
  return requestJson<string[]>('/api/paragraphes/categories');
}

export async function createParagraphe(payload: {
  contenu: string;
  titre?: string | null;
  categorie?: string | null;
  modeleId?: number | null;
  ordre?: number | null;
}): Promise<ParagraphePredefini> {
  const row = await requestJson<ParagrapheRow>(
    '/api/paragraphes',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return mapRow(row);
}

export async function updateParagraphe(
  id: number,
  payload: { contenu: string; titre?: string | null; categorie?: string | null; modeleId?: number | null; ordre?: number | null },
): Promise<ParagraphePredefini> {
  const row = await requestJson<ParagrapheRow>(
    `/api/paragraphes/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
  return mapRow(row);
}

export async function deleteParagraphe(id: number): Promise<void> {
  await requestJson<unknown>(`/api/paragraphes/${id}`, { method: 'DELETE' });
}
