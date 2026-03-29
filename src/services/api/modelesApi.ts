import type {
  DocumentItem,
  ModeleDocumentDetail,
  ModeleDocumentItem,
  ModeleDocumentVersion,
} from '../../types/domain';
import { isNeonDataApiEnabled, requestJson, requestNeonRest, toQueryString } from './utils';

// ---- Types Neon rows ----

type NeonVersionRow = {
  id?: number | null;
  id_modele?: number | null;
  numero_version?: number | null;
  contenu_json?: Record<string, unknown> | null;
  cree_le?: string | null;
  cree_par?: number | null;
};

type NeonModeleRow = {
  id: number;
  id_type_document: number | null;
  nom_modele: string | null;
  description: string | null;
  contenu_json?: Record<string, unknown> | null;
  type_document?: { libelle?: string | null } | null;
  modele_document_version?: NeonVersionRow[] | null;
  modele_sous_domaine?: Array<{ id_sous_domaine?: number | null }> | null;
  paragraphe_predefini?: Array<{ id?: number | null; ordre?: number | null; contenu?: string | null }> | null;
};

// ---- Helpers ----

function pickLatestVersionMeta(versions: NeonVersionRow[] | null | undefined): { numero: number; creeLe: string } {
  if (!Array.isArray(versions) || versions.length === 0) {
    return { numero: 0, creeLe: '' };
  }
  const sorted = [...versions].sort((a, b) => (b.numero_version ?? 0) - (a.numero_version ?? 0));
  return { numero: sorted[0]?.numero_version ?? 0, creeLe: sorted[0]?.cree_le ?? '' };
}

function mapNeonModeleToItem(row: NeonModeleRow): ModeleDocumentItem {
  const latest = pickLatestVersionMeta(row.modele_document_version);
  return {
    id: row.id,
    typeDocumentId: row.id_type_document ?? 0,
    typeDocumentLabel: row.type_document?.libelle ?? '',
    nomModele: row.nom_modele ?? '',
    description: row.description ?? '',
    latestVersion: latest.numero,
    latestVersionCreatedAt: latest.creeLe,
    published: latest.numero > 0,
  };
}

// ---- Neon read implementations ----

async function getModelesFromNeon(filters: { q?: string; publishedOnly?: boolean } = {}): Promise<ModeleDocumentItem[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,id_type_document,nom_modele,description,type_document(libelle),modele_document_version(id,numero_version,cree_le)');
  params.set('order', 'id.asc');

  const q = String(filters.q ?? '').trim();
  if (q) {
    params.set('nom_modele', `ilike.*${q}*`);
  }

  const rows = await requestNeonRest<NeonModeleRow[]>(`/modele_document?${params.toString()}`);
  let items = rows.map(mapNeonModeleToItem);
  if (filters.publishedOnly) {
    items = items.filter((m) => m.published);
  }
  return items;
}

async function getModeleByIdFromNeon(id: number): Promise<ModeleDocumentDetail> {
  const rows = await requestNeonRest<NeonModeleRow[]>(
    `/modele_document?select=id,id_type_document,nom_modele,description,contenu_json,type_document(libelle),modele_sous_domaine(id_sous_domaine),paragraphe_predefini(id,ordre,contenu),modele_document_version(id,numero_version,cree_le,cree_par)&id=eq.${id}&limit=1`,
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Modele introuvable.');
  }
  const sortedVersions = [...(row.modele_document_version ?? [])].sort((a, b) => (b.numero_version ?? 0) - (a.numero_version ?? 0));
  const latest = sortedVersions[0];
  return {
    id: row.id,
    typeDocumentId: row.id_type_document ?? 0,
    typeDocumentLabel: row.type_document?.libelle ?? '',
    nomModele: row.nom_modele ?? '',
    description: row.description ?? '',
    contenuJson: row.contenu_json ?? {},
    sousDomaines: (row.modele_sous_domaine ?? []).map((s) => s.id_sous_domaine ?? 0).filter((n) => n > 0),
    paragraphes: [...(row.paragraphe_predefini ?? [])]
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((p) => ({ id: p.id ?? 0, ordre: p.ordre ?? 0, contenu: p.contenu ?? '' })),
    latestVersion: latest
      ? { id: latest.id ?? 0, modeleId: id, numeroVersion: latest.numero_version ?? 0, contenuJson: {}, creeLe: latest.cree_le ?? '', creePar: latest.cree_par ?? null }
      : null,
  };
}

async function getModeleVersionsFromNeon(id: number): Promise<ModeleDocumentVersion[]> {
  const rows = await requestNeonRest<NeonVersionRow[]>(
    `/modele_document_version?select=id,id_modele,numero_version,contenu_json,cree_le,cree_par&id_modele=eq.${id}&order=numero_version.desc`,
  );
  return rows.map((r) => ({
    id: r.id ?? 0,
    modeleId: r.id_modele ?? id,
    numeroVersion: r.numero_version ?? 0,
    contenuJson: r.contenu_json ?? {},
    creeLe: r.cree_le ?? '',
    creePar: r.cree_par ?? null,
  }));
}

// ---- Public API ----

export async function getModeles(filters: {
  q?: string;
  typeDocumentId?: string;
  sousDomaineId?: string;
  publishedOnly?: boolean;
} = {}) {
  if (isNeonDataApiEnabled()) {
    return getModelesFromNeon({ q: filters.q, publishedOnly: filters.publishedOnly });
  }

  const query = toQueryString({
    q: filters.q,
    typeDocumentId: filters.typeDocumentId,
    sousDomaineId: filters.sousDomaineId,
    publishedOnly: filters.publishedOnly ? 'true' : undefined,
  });

  return requestJson<ModeleDocumentItem[]>(`/api/modeles${query}`);
}

export async function getModeleById(id: number) {
  if (isNeonDataApiEnabled()) {
    return getModeleByIdFromNeon(id);
  }
  return requestJson<ModeleDocumentDetail>(`/api/modeles/${id}`);
}

export async function createModele(payload: {
  typeDocumentId: number;
  nomModele: string;
  description?: string;
  contenuJson?: Record<string, unknown>;
  sousDomaines?: number[];
  paragraphes?: Array<{ ordre?: number; contenu: string }>;
}) {
  return requestJson<ModeleDocumentItem>('/api/modeles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModele(id: number, payload: {
  typeDocumentId?: number;
  nomModele?: string;
  description?: string;
  contenuJson?: Record<string, unknown>;
  sousDomaines?: number[];
  paragraphes?: Array<{ ordre?: number; contenu: string }>;
}) {
  return requestJson<ModeleDocumentItem>(`/api/modeles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function publishModele(id: number, payload: { commentaire?: string } = {}) {
  return requestJson<ModeleDocumentVersion>(`/api/modeles/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getModeleVersions(id: number) {
  if (isNeonDataApiEnabled()) {
    return getModeleVersionsFromNeon(id);
  }
  return requestJson<ModeleDocumentVersion[]>(`/api/modeles/${id}/versions`);
}

export async function getModeleVersion(id: number, version: number) {
  if (isNeonDataApiEnabled()) {
    const rows = await requestNeonRest<NeonVersionRow[]>(
      `/modele_document_version?select=id,id_modele,numero_version,contenu_json,cree_le,cree_par&id_modele=eq.${id}&numero_version=eq.${version}&limit=1`,
    );
    const r = rows[0];
    if (!r) { throw new Error('Version introuvable.'); }
    return { id: r.id ?? 0, modeleId: r.id_modele ?? id, numeroVersion: r.numero_version ?? 0, contenuJson: r.contenu_json ?? {}, creeLe: r.cree_le ?? '', creePar: r.cree_par ?? null } as ModeleDocumentVersion;
  }
  return requestJson<ModeleDocumentVersion>(`/api/modeles/${id}/versions/${version}`);
}

export async function generateDocument(payload: {
  modeleId: number;
  numeroVersion: number;
  scopeType: 'dossier' | 'procedure' | 'instance';
  scopeId: number;
  typeDocumentId?: number;
  variables?: Record<string, unknown>;
}) {
  return requestJson<DocumentItem>('/api/documents/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
