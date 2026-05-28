import type { ParagraphePredefini } from '../../types/domain';
import { isNeonDataApiEnabled, requestJson, requestNeonRest } from './utils';

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

// ---- Neon Data API implementations ----

async function getParagraphesFromNeon(options: { modeleId?: number; categorie?: string } = {}): Promise<ParagraphePredefini[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,id_modele,ordre,titre,categorie,contenu');
  params.set('order', 'ordre.asc.nullsfirst,id.asc');
  if (options.modeleId != null) {
    params.set('id_modele', `eq.${options.modeleId}`);
  }
  if (options.categorie != null) {
    params.set('categorie', `eq.${options.categorie}`);
  }
  const rows = await requestNeonRest<ParagrapheRow[]>(`/paragraphe_predefini?${params.toString()}`);
  return rows.map(mapRow);
}

async function getParagrapheCategoriesFromNeon(): Promise<string[]> {
  const rows = await requestNeonRest<{ categorie: string | null }[]>(
    '/paragraphe_predefini?select=categorie&categorie=not.is.null&order=categorie.asc',
  );
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of rows) {
    if (row.categorie && !seen.has(row.categorie)) {
      seen.add(row.categorie);
      unique.push(row.categorie);
    }
  }
  return unique;
}

// ---- Public API ----

export async function getParagraphes(options: { modeleId?: number; categorie?: string } = {}): Promise<ParagraphePredefini[]> {
  if (isNeonDataApiEnabled()) {
    return getParagraphesFromNeon(options);
  }
  const params = new URLSearchParams();
  if (options.modeleId != null) params.set('modeleId', String(options.modeleId));
  if (options.categorie != null) params.set('categorie', options.categorie);
  const qs = params.size > 0 ? `?${params.toString()}` : '';
  const rows = await requestJson<ParagrapheRow[]>(`/api/paragraphes${qs}`);
  return rows.map(mapRow);
}

export async function getParagrapheCategories(): Promise<string[]> {
  if (isNeonDataApiEnabled()) {
    return getParagrapheCategoriesFromNeon();
  }
  return requestJson<string[]>('/api/paragraphes/categories');
}

export async function createParagraphe(payload: {
  contenu: string;
  titre?: string | null;
  categorie?: string | null;
  modeleId?: number | null;
  ordre?: number | null;
}): Promise<ParagraphePredefini> {
  if (isNeonDataApiEnabled()) {
    const body = {
      contenu: payload.contenu,
      titre: payload.titre ?? null,
      categorie: payload.categorie ?? null,
      id_modele: payload.modeleId ?? null,
      ordre: payload.ordre ?? null,
    };
    const rows = await requestNeonRest<ParagrapheRow[]>('/paragraphe_predefini', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!rows[0]) { throw new Error('Paragraphe non créé.'); }
    return mapRow(rows[0]);
  }
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
  if (isNeonDataApiEnabled()) {
    const body = {
      contenu: payload.contenu,
      titre: payload.titre ?? null,
      categorie: payload.categorie ?? null,
      id_modele: payload.modeleId ?? null,
      ordre: payload.ordre ?? null,
    };
    const rows = await requestNeonRest<ParagrapheRow[]>(`/paragraphe_predefini?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!rows[0]) { throw new Error('Paragraphe introuvable.'); }
    return mapRow(rows[0]);
  }
  const row = await requestJson<ParagrapheRow>(
    `/api/paragraphes/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
  return mapRow(row);
}

export async function deleteParagraphe(id: number): Promise<void> {
  if (isNeonDataApiEnabled()) {
    await requestNeonRest<unknown>(`/paragraphe_predefini?id=eq.${id}`, { method: 'DELETE' });
    return;
  }
  await requestJson<unknown>(`/api/paragraphes/${id}`, { method: 'DELETE' });
}
