import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { query, testConnection } from './db.js';
import { extractBearerToken, validateNeonToken } from './neon-jwt.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
app.disable('x-powered-by');
const apiPort = Number(process.env.PORT || process.env.API_PORT || 8787);
const NO_ACCESS_AGENCE_FILTER = '__no_agence_access__';

const ALLOWED_DOCUMENT_SCOPE_TYPES = new Set(['dossier', 'procedure', 'instance']);

const configuredCorsOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function isAllowedCorsOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (configuredCorsOrigins.has(origin)) {
    return true;
  }

  // Allow GitHub Pages origins by default for static production frontend hosting.
  return /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin);
}

app.use(express.json({ limit: '1mb' }));

app.use((request, response, next) => {
  const origin = request.get('origin');
  if (isAllowedCorsOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Agency, X-Session-Metier, X-Session-User-Id, X-Session-User-Email, X-Session-User');
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

app.get('/healthz', async (request, response) => {
  try {
    await testConnection();
    response.status(200).json({ ok: true });
  } catch (error) {
    response.status(503).json({ ok: false, message: error.message });
  }
});

app.get('/api/auth/verify-token', async (request, response) => {
  const token = extractBearerToken(request.get('authorization'));
  if (!token) {
    response.status(400).json({ valid: false, message: 'Authorization Bearer token manquant.' });
    return;
  }

  const payload = await validateNeonToken(token);
  if (!payload) {
    response.status(401).json({ valid: false, message: 'Token invalide.' });
    return;
  }

  response.json({ valid: true, payload });
});

function toNullableText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toSearchPattern(value) {
  const normalized = toNullableText(value);
  return normalized ? `%${normalized}%` : null;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'oui'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'non'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function toJsonObject(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  return null;
}

function getSessionContext(request) {
  return {
    agence: toNullableText(request.get('X-Session-Agency')),
    metier: toNullableText(request.get('X-Session-Metier')),
    userId: toNullableText(request.get('X-Session-User-Id')),
    userEmail: toNullableText(request.get('X-Session-User-Email')),
    user: toNullableText(request.get('X-Session-User')),
  };
}

function isNumericIdentifier(value) {
  return /^\d+$/.test(value);
}

async function resolveAgenceFilter(requestedAgence, sessionContext) {
  const metier = toNullableText(sessionContext.metier);
  if (metier?.toLowerCase() === 'collaborateur') {
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);
    if (!collaborateurScope.restrictToCollaborateur || collaborateurScope.collaborateurId === null) {
      return NO_ACCESS_AGENCE_FILTER;
    }

    const collaboratorAgency = await query(
      `
        SELECT id_agence AS "agenceId"
        FROM collaborateur
        WHERE id = $1
        LIMIT 1
      `,
      [collaborateurScope.collaborateurId],
    );

    const agenceId = collaboratorAgency.rows[0]?.agenceId;
    return agenceId === null || agenceId === undefined ? NO_ACCESS_AGENCE_FILTER : String(agenceId);
  }

  const candidate = toNullableText(requestedAgence) ?? sessionContext.agence;
  if (!candidate) {
    return null;
  }

  // Resolve to a real agence id; if unknown, do not apply a restrictive filter.
  const matched = await query(
    `
      SELECT id
      FROM agence
      WHERE id::text = $1
        OR lower(nom) = lower($1)
        OR lower(ville) = lower($1)
      ORDER BY id
      LIMIT 1
    `,
    [candidate],
  );

  return matched.rows[0] ? String(matched.rows[0].id) : null;
}

async function resolveAgenceIdForMutation(requestedAgence, sessionContext) {
  const agenceFilter = await resolveAgenceFilter(requestedAgence, sessionContext);

  if (agenceFilter === NO_ACCESS_AGENCE_FILTER) {
    return null;
  }

  if (agenceFilter && isNumericIdentifier(agenceFilter)) {
    return Number(agenceFilter);
  }

  const agenceLabel = toNullableText(requestedAgence) ?? sessionContext.agence;
  return findOrCreateAgenceId(agenceLabel);
}

function buildFullNameFromSessionUserId(userId) {
  const normalized = toNullableText(userId);
  if (!(normalized?.startsWith('u-'))) {
    return null;
  }

  const [firstName, ...lastNameParts] = normalized
    .slice(2)
    .split('-')
    .filter(Boolean);

  if (!firstName || lastNameParts.length === 0) {
    return null;
  }

  return `${firstName} ${lastNameParts.join(' ')}`;
}

async function findCollaborateurIdByEmail(email) {
  const normalized = toNullableText(email);
  if (!normalized) {
    return null;
  }

  const result = await query(
    `
      SELECT id
      FROM collaborateur
      WHERE lower(email) = lower($1)
      ORDER BY id
      LIMIT 1
    `,
    [normalized],
  );

  return result.rows[0]?.id ?? null;
}

async function resolveCollaborateurScope(sessionContext) {
  const metier = toNullableText(sessionContext.metier);
  if (metier?.toLowerCase() !== 'collaborateur') {
    return { restrictToCollaborateur: false, collaborateurId: null };
  }

  const collaboratorByEmail = await findCollaborateurIdByEmail(sessionContext.userEmail);
  if (collaboratorByEmail !== null) {
    return { restrictToCollaborateur: true, collaborateurId: collaboratorByEmail };
  }

  const candidates = [];
  const sessionUser = toNullableText(sessionContext.user);
  if (sessionUser) {
    candidates.push(sessionUser);
  }

  const userIdName = buildFullNameFromSessionUserId(sessionContext.userId);
  if (userIdName && !candidates.some((candidate) => candidate.toLowerCase() === userIdName.toLowerCase())) {
    candidates.push(userIdName);
  }

  for (const candidate of candidates) {
    const collaboratorId = await findCollaborateurId(candidate);
    if (collaboratorId !== null) {
      return { restrictToCollaborateur: true, collaborateurId: collaboratorId };
    }
  }

  return { restrictToCollaborateur: true, collaborateurId: null };
}

function splitFullName(value) {
  const normalized = toNullableText(value);
  if (!normalized) {
    return { firstName: 'Nouveau', lastName: 'Client' };
  }

  const [firstName, ...rest] = normalized.split(/\s+/);
  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(' ') : 'Client',
  };
}

async function findOrCreateAgenceId(agenceValue) {
  const normalized = toNullableText(agenceValue);
  if (!normalized) {
    return null;
  }

  if (isNumericIdentifier(normalized)) {
    const byId = await query(
      `
        SELECT id
        FROM agence
        WHERE id = $1::int
        LIMIT 1
      `,
      [normalized],
    );

    if (byId.rows[0]) {
      return byId.rows[0].id;
    }
  }

  const existing = await query(
    `
      SELECT id
      FROM agence
      WHERE lower(nom) = lower($1) OR lower(ville) = lower($1)
      ORDER BY id
      LIMIT 1
    `,
    [normalized],
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await query(
    `
      INSERT INTO agence (nom, ville)
      VALUES ($1, $1)
      RETURNING id
    `,
    [normalized],
  );

  return inserted.rows[0].id;
}

async function findOrCreateLabelId(kind, label) {
  const normalized = toNullableText(label);
  if (!normalized) {
    return null;
  }

  const lookup = {
    type_dossier: { tableName: 'type_dossier', columnName: 'libelle' },
    statut_dossier: { tableName: 'statut_dossier', columnName: 'libelle' },
    type_procedure: { tableName: 'type_procedure', columnName: 'libelle' },
    statut_procedure: { tableName: 'statut_procedure', columnName: 'libelle' },
    type_instance: { tableName: 'type_instance', columnName: 'libelle' },
    statut_instance: { tableName: 'statut_instance', columnName: 'libelle' },
    type_document: { tableName: 'type_document', columnName: 'libelle' },
  }[kind];

  if (!lookup) {
    throw new Error(`Unsupported label lookup: ${kind}`);
  }

  if (isNumericIdentifier(normalized)) {
    const byId = await query(
      `
        SELECT id
        FROM ${lookup.tableName}
        WHERE id = $1::int
        LIMIT 1
      `,
      [normalized],
    );

    if (byId.rows[0]) {
      return byId.rows[0].id;
    }
  }

  const existing = await query(
    `
      SELECT id
      FROM ${lookup.tableName}
      WHERE lower(${lookup.columnName}) = lower($1)
      ORDER BY id
      LIMIT 1
    `,
    [normalized],
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await query(
    `
      INSERT INTO ${lookup.tableName} (${lookup.columnName})
      VALUES ($1)
      RETURNING id
    `,
    [normalized],
  );

  return inserted.rows[0].id;
}

async function findCollaborateurId(fullName) {
  const normalized = toNullableText(fullName);
  if (!normalized) {
    return null;
  }

  const result = await query(
    `
      SELECT id
      FROM collaborateur
      WHERE lower(trim(concat_ws(' ', prenom, nom))) = lower($1)
      ORDER BY id
      LIMIT 1
    `,
    [normalized],
  );

  return result.rows[0]?.id ?? null;
}

async function findOrCreateClientId(fullName, agenceId) {
  const normalized = toNullableText(fullName);
  if (!normalized) {
    return null;
  }

  if (isNumericIdentifier(normalized)) {
    const byId = await query(
      `
        SELECT id
        FROM client
        WHERE id = $1::int
        LIMIT 1
      `,
      [normalized],
    );

    if (byId.rows[0]) {
      return byId.rows[0].id;
    }
  }

  const existing = await query(
    `
      SELECT id
      FROM client
      WHERE lower(trim(concat_ws(' ', prenom, nom))) = lower($1)
      ORDER BY id
      LIMIT 1
    `,
    [normalized],
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const { firstName, lastName } = splitFullName(normalized);
  const inserted = await query(
    `
      INSERT INTO client (id_agence, nom, prenom)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [agenceId, lastName, firstName],
  );

  return inserted.rows[0].id;
}

async function getClientById(clientId) {
  const result = await query(
    `
      SELECT
        c.id,
        c.nom,
        c.prenom,
        COALESCE(c.email, '') AS email,
        COALESCE(c.telephone, '') AS telephone,
        COALESCE(a.nom, a.ville, 'Non renseignee') AS agence,
        COALESCE(trim(concat_ws(' ', cr.prenom, cr.nom)), 'Non assigne') AS responsable
      FROM client c
      LEFT JOIN agence a ON a.id = c.id_agence
      LEFT JOIN collaborateur cr ON cr.id = c.id_collaborateur_responsable
      WHERE c.id = $1
    `,
    [clientId],
  );

  return result.rows[0] ?? null;
}

async function getDossierById(dossierId) {
  const result = await query(
    `
      SELECT
        d.id,
        COALESCE(d.reference, '') AS reference,
        d.id_client AS "clientId",
        COALESCE(trim(concat_ws(' ', c.prenom, c.nom)), 'Non renseigne') AS client,
        d.id_type_dossier AS "typeId",
        COALESCE(td.libelle, 'Non renseigne') AS type,
        d.id_statut_dossier AS "statutId",
        COALESCE(sd.libelle, 'Non renseigne') AS statut,
        d.id_agence AS "agenceId",
        COALESCE(a.nom, a.ville, 'Non renseignee') AS agence,
        COALESCE(to_char(d.date_ouverture, 'YYYY-MM-DD'), '') AS ouverture,
        COALESCE(to_char(d.date_cloture, 'YYYY-MM-DD'), '') AS echeance,
        COALESCE(latest_facture.montant, 0)::float8 AS montant
      FROM dossier d
      LEFT JOIN client c ON c.id = d.id_client
      LEFT JOIN type_dossier td ON td.id = d.id_type_dossier
      LEFT JOIN statut_dossier sd ON sd.id = d.id_statut_dossier
      LEFT JOIN agence a ON a.id = d.id_agence
      LEFT JOIN LATERAL (
        SELECT montant
        FROM facture f
        WHERE f.id_dossier = d.id
        ORDER BY f.date_emission DESC NULLS LAST, f.id DESC
        LIMIT 1
      ) AS latest_facture ON true
      WHERE d.id = $1
    `,
    [dossierId],
  );

  return result.rows[0] ?? null;
}

async function getProcedureById(procedureId) {
  const result = await query(
    `
      SELECT
        p.id,
        p.id_dossier AS "dossierId",
        COALESCE(d.reference, '') AS "dossierReference",
        p.id_type_procedure AS "typeId",
        COALESCE(tp.libelle, 'Non renseigne') AS type,
        p.id_statut_procedure AS "statutId",
        COALESCE(sp.libelle, 'Non renseigne') AS statut,
        COALESCE(latest_instance.juridiction, 'Instance') AS juridiction,
        COALESCE(to_char(p.date_debut, 'YYYY-MM-DD'), '') AS debut,
        COALESCE(to_char(p.date_fin, 'YYYY-MM-DD'), '') AS fin
      FROM "procedure" p
      LEFT JOIN dossier d ON d.id = p.id_dossier
      LEFT JOIN type_procedure tp ON tp.id = p.id_type_procedure
      LEFT JOIN statut_procedure sp ON sp.id = p.id_statut_procedure
      LEFT JOIN LATERAL (
        SELECT COALESCE(ti.libelle, 'Instance') AS juridiction
        FROM instance_juridique ij
        LEFT JOIN type_instance ti ON ti.id = ij.id_type_instance
        WHERE ij.id_procedure = p.id
        ORDER BY ij.id DESC
        LIMIT 1
      ) AS latest_instance ON true
      WHERE p.id = $1
    `,
    [procedureId],
  );

  return result.rows[0] ?? null;
}

async function getProcedureInstancesByProcedureId(procedureId) {
  const result = await query(
    `
      SELECT
        ij.id,
        COALESCE(ti.libelle, 'Instance') AS type,
        COALESCE(si.libelle, 'Non renseigne') AS statut,
        COALESCE(to_char(ij.date_debut, 'YYYY-MM-DD'), '') AS debut,
        COALESCE(to_char(ij.date_fin, 'YYYY-MM-DD'), '') AS fin
      FROM instance_juridique ij
      LEFT JOIN type_instance ti ON ti.id = ij.id_type_instance
      LEFT JOIN statut_instance si ON si.id = ij.id_statut_instance
      WHERE ij.id_procedure = $1
      ORDER BY ij.id DESC
    `,
    [procedureId],
  );

  return result.rows;
}

async function getInstanceById(instanceId) {
  const result = await query(
    `
      SELECT
        ij.id,
        ij.id_procedure AS "procedureId",
        COALESCE(ti.libelle, 'Instance') AS type,
        COALESCE(si.libelle, 'Non renseigne') AS statut,
        COALESCE(to_char(ij.date_debut, 'YYYY-MM-DD'), '') AS debut,
        COALESCE(to_char(ij.date_fin, 'YYYY-MM-DD'), '') AS fin
      FROM instance_juridique ij
      LEFT JOIN type_instance ti ON ti.id = ij.id_type_instance
      LEFT JOIN statut_instance si ON si.id = ij.id_statut_instance
      WHERE ij.id = $1
      LIMIT 1
    `,
    [instanceId],
  );

  return result.rows[0] ?? null;
}

async function getProcedureHistoryByProcedureId(procedureId) {
  const result = await query(
    `
      SELECT
        hp.id,
        COALESCE(hp.description, 'Modification de la procedure') AS action,
        COALESCE(trim(concat_ws(' ', c.prenom, c.nom)), 'Systeme API Cabinet') AS actor,
        COALESCE(to_char(hp.date_modification, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS at,
        COALESCE(hp.description, 'Aucun detail fourni') AS details
      FROM historique_procedure hp
      LEFT JOIN collaborateur c ON c.id = hp.auteur
      WHERE hp.id_procedure = $1
      ORDER BY hp.date_modification DESC NULLS LAST, hp.id DESC
    `,
    [procedureId],
  );

  return result.rows;
}

function buildProcedureHistoryDescription(previousProcedure, nextProcedure) {
  if (!previousProcedure || !nextProcedure) {
    return 'Modification des donnees de la procedure.';
  }

  const changes = [];

  if (previousProcedure.type !== nextProcedure.type) {
    changes.push(`type: "${previousProcedure.type}" -> "${nextProcedure.type}"`);
  }

  if (previousProcedure.statut !== nextProcedure.statut) {
    changes.push(`statut: "${previousProcedure.statut}" -> "${nextProcedure.statut}"`);
  }

  if (previousProcedure.debut !== nextProcedure.debut) {
    changes.push(`debut: "${previousProcedure.debut || 'Non renseigne'}" -> "${nextProcedure.debut || 'Non renseigne'}"`);
  }

  if (previousProcedure.fin !== nextProcedure.fin) {
    changes.push(`fin: "${previousProcedure.fin || 'En cours'}" -> "${nextProcedure.fin || 'En cours'}"`);
  }

  if (changes.length === 0) {
    return 'Sauvegarde de la procedure sans changement detecte.';
  }

  return `Mise a jour procedure (${changes.join(' | ')})`;
}

function buildInstanceHistoryDescription(previousInstance, nextInstance) {
  if (!previousInstance || !nextInstance) {
    return 'Modification des donnees d\'instance.';
  }

  const changes = [];

  if (previousInstance.type !== nextInstance.type) {
    changes.push(`type instance: "${previousInstance.type}" -> "${nextInstance.type}"`);
  }

  if (previousInstance.statut !== nextInstance.statut) {
    changes.push(`statut instance: "${previousInstance.statut}" -> "${nextInstance.statut}"`);
  }

  if (previousInstance.debut !== nextInstance.debut) {
    changes.push(`debut instance: "${previousInstance.debut || 'Non renseigne'}" -> "${nextInstance.debut || 'Non renseigne'}"`);
  }

  if (previousInstance.fin !== nextInstance.fin) {
    changes.push(`fin instance: "${previousInstance.fin || 'En cours'}" -> "${nextInstance.fin || 'En cours'}"`);
  }

  if (changes.length === 0) {
    return `Sauvegarde de l'instance #${nextInstance.id} sans changement detecte.`;
  }

  return `Mise a jour instance #${nextInstance.id} (${changes.join(' | ')})`;
}

async function hasProcedureAccess(procedureId, agenceFilter, collaborateurId) {
  const result = await query(
    `
      SELECT 1
      FROM "procedure" p
      LEFT JOIN dossier d ON d.id = p.id_dossier
      LEFT JOIN client c ON c.id = d.id_client
      LEFT JOIN agence a ON a.id = d.id_agence
      WHERE p.id = $1
        AND ($2::text IS NULL OR a.id::text = $2 OR lower(a.nom) = lower($2) OR lower(a.ville) = lower($2))
        AND ($3::int IS NULL
          OR c.id_collaborateur_responsable = $3
          OR EXISTS (
            SELECT 1
            FROM affectation_dossier ad
            WHERE ad.id_dossier = d.id
              AND ad.id_collaborateur = $3
              AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
          )
          OR EXISTS (
            SELECT 1
            FROM affectation_procedure ap
            WHERE ap.id_procedure = p.id
              AND ap.id_collaborateur = $3
              AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
          ))
      LIMIT 1
    `,
    [procedureId, agenceFilter, collaborateurId],
  );

  return Boolean(result.rows[0]);
}

async function getDocumentById(documentId) {
  const result = await query(
    `
      SELECT
        d.id,
        COALESCE(td.libelle, 'Document') AS type,
        COALESCE(ds.reference, pds.reference, ids.reference, '') AS "dossierReference",
        d.id_procedure AS "procedureId",
        d.id_instance AS "instanceId",
        COALESCE(trim(concat_ws(' ', c.prenom, c.nom)), 'Non assigne') AS auteur,
        COALESCE(to_char(d.date_creation, 'YYYY-MM-DD'), '') AS "dateCreation",
        COALESCE(d.statut_document,
          CASE
            WHEN d.date_creation IS NULL THEN 'Brouillon'
            WHEN d.date_creation < NOW() - INTERVAL '30 days' THEN 'Valide'
            ELSE 'A relire'
          END
        ) AS statut,
        d.id_modele AS "modeleId",
        d.numero_version_modele AS "modeleVersion"
      FROM document d
      LEFT JOIN type_document td ON td.id = d.id_type_document
      LEFT JOIN dossier ds ON ds.id = d.id_dossier
      LEFT JOIN "procedure" p ON p.id = d.id_procedure
      LEFT JOIN dossier pds ON pds.id = p.id_dossier
      LEFT JOIN instance_juridique ij ON ij.id = d.id_instance
      LEFT JOIN "procedure" ip ON ip.id = ij.id_procedure
      LEFT JOIN dossier ids ON ids.id = ip.id_dossier
      LEFT JOIN collaborateur c ON c.id = d.auteur
      WHERE d.id = $1
    `,
    [documentId],
  );

  return result.rows[0] ?? null;
}

async function getModeleById(modeleId) {
  const result = await query(
    `
      SELECT
        md.id,
        md.id_type_document AS "typeDocumentId",
        COALESCE(td.libelle, 'Document') AS "typeDocumentLabel",
        COALESCE(md.nom_modele, '') AS "nomModele",
        COALESCE(md.description, '') AS description,
        COALESCE(md.contenu_json, '{}'::jsonb) AS "contenuJson"
      FROM modele_document md
      LEFT JOIN type_document td ON td.id = md.id_type_document
      WHERE md.id = $1
      LIMIT 1
    `,
    [modeleId],
  );

  return result.rows[0] ?? null;
}

async function getLatestModeleVersion(modeleId) {
  const result = await query(
    `
      SELECT
        id,
        id_modele AS "modeleId",
        numero_version AS "numeroVersion",
        contenu_json AS "contenuJson",
        COALESCE(to_char(cree_le, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS "creeLe",
        cree_par AS "creePar"
      FROM modele_document_version
      WHERE id_modele = $1
      ORDER BY numero_version DESC
      LIMIT 1
    `,
    [modeleId],
  );

  return result.rows[0] ?? null;
}

async function getModeleVersion(modeleId, numeroVersion) {
  const result = await query(
    `
      SELECT
        id,
        id_modele AS "modeleId",
        numero_version AS "numeroVersion",
        contenu_json AS "contenuJson",
        COALESCE(to_char(cree_le, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS "creeLe",
        cree_par AS "creePar"
      FROM modele_document_version
      WHERE id_modele = $1
        AND numero_version = $2
      LIMIT 1
    `,
    [modeleId, numeroVersion],
  );

  return result.rows[0] ?? null;
}

async function resolveDocumentScope(scopeType, scopeId, agenceFilter, collaborateurId) {
  if (!ALLOWED_DOCUMENT_SCOPE_TYPES.has(scopeType)) {
    return null;
  }

  if (!Number.isFinite(scopeId)) {
    return null;
  }

  if (scopeType === 'dossier') {
    const result = await query(
      `
        SELECT
          d.id AS "dossierId",
          NULL::int AS "procedureId",
          NULL::int AS "instanceId",
          d.reference AS "dossierReference"
        FROM dossier d
        LEFT JOIN client c ON c.id = d.id_client
        LEFT JOIN agence a ON a.id = d.id_agence
        WHERE d.id = $1
          AND ($2::text IS NULL OR a.id::text = $2 OR lower(a.nom) = lower($2) OR lower(a.ville) = lower($2))
          AND ($3::int IS NULL
            OR c.id_collaborateur_responsable = $3
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $3
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            ))
        LIMIT 1
      `,
      [scopeId, agenceFilter, collaborateurId],
    );

    return result.rows[0] ?? null;
  }

  if (scopeType === 'procedure') {
    const result = await query(
      `
        SELECT
          d.id AS "dossierId",
          p.id AS "procedureId",
          NULL::int AS "instanceId",
          d.reference AS "dossierReference"
        FROM "procedure" p
        LEFT JOIN dossier d ON d.id = p.id_dossier
        LEFT JOIN client c ON c.id = d.id_client
        LEFT JOIN agence a ON a.id = d.id_agence
        WHERE p.id = $1
          AND ($2::text IS NULL OR a.id::text = $2 OR lower(a.nom) = lower($2) OR lower(a.ville) = lower($2))
          AND ($3::int IS NULL
            OR c.id_collaborateur_responsable = $3
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $3
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            )
            OR EXISTS (
              SELECT 1
              FROM affectation_procedure ap
              WHERE ap.id_procedure = p.id
                AND ap.id_collaborateur = $3
                AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
            ))
        LIMIT 1
      `,
      [scopeId, agenceFilter, collaborateurId],
    );

    return result.rows[0] ?? null;
  }

  const result = await query(
    `
      SELECT
        d.id AS "dossierId",
        p.id AS "procedureId",
        ij.id AS "instanceId",
        d.reference AS "dossierReference"
      FROM instance_juridique ij
      LEFT JOIN "procedure" p ON p.id = ij.id_procedure
      LEFT JOIN dossier d ON d.id = p.id_dossier
      LEFT JOIN client c ON c.id = d.id_client
      LEFT JOIN agence a ON a.id = d.id_agence
      WHERE ij.id = $1
        AND ($2::text IS NULL OR a.id::text = $2 OR lower(a.nom) = lower($2) OR lower(a.ville) = lower($2))
        AND ($3::int IS NULL
          OR c.id_collaborateur_responsable = $3
          OR EXISTS (
            SELECT 1
            FROM affectation_dossier ad
            WHERE ad.id_dossier = d.id
              AND ad.id_collaborateur = $3
              AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
          )
          OR EXISTS (
            SELECT 1
            FROM affectation_procedure ap
            WHERE ap.id_procedure = p.id
              AND ap.id_collaborateur = $3
              AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
          ))
      LIMIT 1
    `,
    [scopeId, agenceFilter, collaborateurId],
  );

  return result.rows[0] ?? null;
}

async function syncModeleSousDomaines(modeleId, sousDomaines, replace = false) {
  if (!Array.isArray(sousDomaines)) {
    return;
  }

  if (replace) {
    await query('DELETE FROM modele_sous_domaine WHERE id_modele = $1', [modeleId]);
  }

  for (const sousDomaineId of sousDomaines) {
    if (!Number.isFinite(Number(sousDomaineId))) {
      continue;
    }

    await query(
      `
        INSERT INTO modele_sous_domaine (id_modele, id_sous_domaine)
        VALUES ($1, $2::int)
        ON CONFLICT DO NOTHING
      `,
      [modeleId, sousDomaineId],
    );
  }
}

function normalizeParagraphes(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalized = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const contenu = toNullableText(entry?.contenu);
    if (!contenu) {
      continue;
    }

    const ordre = Number.isFinite(Number(entry?.ordre)) ? Number(entry.ordre) : index + 1;
    normalized.push({ ordre, contenu });
  }

  return normalized;
}

async function syncModeleParagraphes(modeleId, paragraphes, replace = false) {
  if (!Array.isArray(paragraphes)) {
    return;
  }

  if (replace) {
    await query('DELETE FROM paragraphe_predefini WHERE id_modele = $1', [modeleId]);
  }

  const normalized = normalizeParagraphes(paragraphes);
  for (const entry of normalized) {
    await query(
      `
        INSERT INTO paragraphe_predefini (id_modele, ordre, contenu)
        VALUES ($1, $2, $3)
      `,
      [modeleId, entry.ordre, entry.contenu],
    );
  }
}

app.get('/api/health', async (request, response) => {
  try {
    await testConnection();
    response.json({ ok: true, database: 'connected' });
  } catch (error) {
    response.status(503).json({ ok: false, database: 'disconnected', message: error.message });
  }
});

app.get('/api/agence', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);
    let agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);

    if (collaborateurScope.restrictToCollaborateur) {
      if (collaborateurScope.collaborateurId === null) {
        response.json([]);
        return;
      }

      if (agenceFilter === null) {
        const collaboratorAgency = await query(
          `
            SELECT id_agence AS "agenceId"
            FROM collaborateur
            WHERE id = $1
            LIMIT 1
          `,
          [collaborateurScope.collaborateurId],
        );

        const agenceId = collaboratorAgency.rows[0]?.agenceId;
        if (agenceId === null || agenceId === undefined) {
          response.json([]);
          return;
        }

        agenceFilter = String(agenceId);
      }
    }

    const result = await query(
      `
        SELECT id, nom
        FROM agence
        WHERE ($1::text IS NULL OR id::text = $1 OR lower(nom) = lower($1) OR lower(ville) = lower($1))
        ORDER BY nom ASC, id ASC
      `,
      [agenceFilter],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/type_dossier', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM type_dossier
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/type_procedure', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM type_procedure
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/type_instance', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM type_instance
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/type_document', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM type_document
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/statut_dossier', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM statut_dossier
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/statut_procedure', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM statut_procedure
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/statut_instance', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT id, libelle
        FROM statut_instance
        ORDER BY id ASC
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.json([
        {
          code: 'active-dossiers',
          label: 'Dossiers actifs',
          value: '0',
          trend: 'Hors statuts Clos/Cloture',
          trendUp: true,
        },
        {
          code: 'delayed-procedures',
          label: 'Procedures en retard',
          value: '0',
          trend: 'Ouvertes depuis plus de 14 jours',
          trendUp: false,
        },
        {
          code: 'upcoming-hearings',
          label: 'Audiences sous 7 jours',
          value: '0',
          trend: 'Date audience entre J0 et J+7',
          trendUp: false,
        },
        {
          code: 'pending-documents',
          label: 'Documents a valider',
          value: '0',
          trend: 'Sans date ou crees depuis 30 jours',
          trendUp: false,
        },
      ]);
      return;
    }

    const [activeDossiers, delayedProcedures, upcomingHearings, pendingDocuments] = await Promise.all([
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM dossier d
          LEFT JOIN statut_dossier sd ON sd.id = d.id_statut_dossier
          LEFT JOIN client c ON c.id = d.id_client
          LEFT JOIN agence a ON a.id = d.id_agence
          WHERE COALESCE(lower(sd.libelle), '') NOT IN ('cloture', 'clôture', 'clos')
            AND ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
            AND ($2::int IS NULL
              OR c.id_collaborateur_responsable = $2
              OR EXISTS (
                SELECT 1
                FROM affectation_dossier ad
                WHERE ad.id_dossier = d.id
                  AND ad.id_collaborateur = $2
                  AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
              ))
        `,
        [agenceFilter, collaborateurScope.collaborateurId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM "procedure" p
          LEFT JOIN dossier d ON d.id = p.id_dossier
          LEFT JOIN client c ON c.id = d.id_client
          LEFT JOIN agence a ON a.id = d.id_agence
          WHERE p.date_fin IS NULL
            AND p.date_debut IS NOT NULL
            AND p.date_debut < CURRENT_DATE - INTERVAL '14 days'
            AND ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
            AND ($2::int IS NULL
              OR c.id_collaborateur_responsable = $2
              OR EXISTS (
                SELECT 1
                FROM affectation_dossier ad
                WHERE ad.id_dossier = d.id
                  AND ad.id_collaborateur = $2
                  AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
              )
              OR EXISTS (
                SELECT 1
                FROM affectation_procedure ap
                WHERE ap.id_procedure = p.id
                  AND ap.id_collaborateur = $2
                  AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
              ))
        `,
        [agenceFilter, collaborateurScope.collaborateurId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM audience aud
          LEFT JOIN instance_juridique ij ON ij.id = aud.id_instance
          LEFT JOIN "procedure" p ON p.id = ij.id_procedure
          LEFT JOIN dossier d ON d.id = p.id_dossier
          LEFT JOIN client c ON c.id = d.id_client
          LEFT JOIN agence a ON a.id = d.id_agence
          WHERE aud.date_audience BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            AND ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
            AND ($2::int IS NULL
              OR c.id_collaborateur_responsable = $2
              OR EXISTS (
                SELECT 1
                FROM affectation_dossier ad
                WHERE ad.id_dossier = d.id
                  AND ad.id_collaborateur = $2
                  AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
              )
              OR EXISTS (
                SELECT 1
                FROM affectation_procedure ap
                WHERE ap.id_procedure = p.id
                  AND ap.id_collaborateur = $2
                  AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
              ))
        `,
        [agenceFilter, collaborateurScope.collaborateurId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM document doc
          LEFT JOIN dossier direct_dossier ON direct_dossier.id = doc.id_dossier
          LEFT JOIN "procedure" doc_procedure ON doc_procedure.id = doc.id_procedure
          LEFT JOIN dossier procedure_dossier ON procedure_dossier.id = doc_procedure.id_dossier
          LEFT JOIN instance_juridique doc_instance ON doc_instance.id = doc.id_instance
          LEFT JOIN "procedure" instance_procedure ON instance_procedure.id = doc_instance.id_procedure
          LEFT JOIN dossier instance_dossier ON instance_dossier.id = instance_procedure.id_dossier
          LEFT JOIN client c ON c.id = COALESCE(direct_dossier.id_client, procedure_dossier.id_client, instance_dossier.id_client)
          LEFT JOIN agence a ON a.id = COALESCE(direct_dossier.id_agence, procedure_dossier.id_agence, instance_dossier.id_agence)
          WHERE (
            doc.date_creation IS NULL
            OR doc.date_creation >= NOW() - INTERVAL '30 days'
          )
            AND ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
            AND ($2::int IS NULL
              OR c.id_collaborateur_responsable = $2
              OR EXISTS (
                SELECT 1
                FROM affectation_dossier ad
                WHERE ad.id_dossier = COALESCE(direct_dossier.id, procedure_dossier.id, instance_dossier.id)
                  AND ad.id_collaborateur = $2
                  AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
              )
              OR EXISTS (
                SELECT 1
                FROM affectation_procedure ap
                WHERE ap.id_procedure = COALESCE(doc.id_procedure, doc_instance.id_procedure)
                  AND ap.id_collaborateur = $2
                  AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
              ))
        `,
        [agenceFilter, collaborateurScope.collaborateurId],
      ),
    ]);

    response.json([
      {
        code: 'active-dossiers',
        label: 'Dossiers actifs',
        value: String(activeDossiers.rows[0]?.total ?? 0),
        trend: 'Hors statuts Clos/Cloture',
        trendUp: true,
      },
      {
        code: 'delayed-procedures',
        label: 'Procedures en retard',
        value: String(delayedProcedures.rows[0]?.total ?? 0),
        trend: 'Ouvertes depuis plus de 14 jours',
        trendUp: false,
      },
      {
        code: 'upcoming-hearings',
        label: 'Audiences sous 7 jours',
        value: String(upcomingHearings.rows[0]?.total ?? 0),
        trend: 'Date audience entre J0 et J+7',
        trendUp: false,
      },
      {
        code: 'pending-documents',
        label: 'Documents a valider',
        value: String(pendingDocuments.rows[0]?.total ?? 0),
        trend: 'Sans date ou crees depuis 30 jours',
        trendUp: false,
      },
    ]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/clients', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const searchPattern = toSearchPattern(request.query.q);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);

    const result = await query(
      `
        SELECT
          c.id,
          c.nom,
          c.prenom,
          COALESCE(c.email, '') AS email,
          COALESCE(c.telephone, '') AS telephone,
          COALESCE(a.nom, a.ville, 'Non renseignee') AS agence,
          COALESCE(trim(concat_ws(' ', cr.prenom, cr.nom)), 'Non assigne') AS responsable
        FROM client c
        LEFT JOIN agence a ON a.id = c.id_agence
        LEFT JOIN collaborateur cr ON cr.id = c.id_collaborateur_responsable
        WHERE ($1::text IS NULL
          OR c.nom ILIKE $1
          OR c.prenom ILIKE $1
          OR c.email ILIKE $1
          OR c.telephone ILIKE $1)
          AND ($2::text IS NULL
            OR a.id::text = $2
            OR lower(a.nom) = lower($2)
            OR lower(a.ville) = lower($2))
        ORDER BY c.id DESC
      `,
      [searchPattern, agenceFilter],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/clients', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const nom = toNullableText(request.body.nom);
    const prenom = toNullableText(request.body.prenom);

    if (!nom || !prenom) {
      response.status(400).json({ message: 'nom et prenom sont obligatoires.' });
      return;
    }

    const email = toNullableText(request.body.email);
    const telephone = toNullableText(request.body.telephone);
    const responsableName = toNullableText(request.body.responsable) ?? sessionContext.user;
    const agenceId = await resolveAgenceIdForMutation(request.body.agence, sessionContext);
    if (agenceId === null) {
      response.status(403).json({ message: 'Aucune agence autorisee pour ce collaborateur.' });
      return;
    }
    const responsableId = await findCollaborateurId(responsableName);

    const inserted = await query(
      `
        INSERT INTO client (id_agence, id_collaborateur_responsable, nom, prenom, email, telephone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [agenceId, responsableId, nom, prenom, email, telephone],
    );

    const row = await getClientById(inserted.rows[0].id);
    response.status(201).json(row);
  } catch (error) {
    next(error);
  }
});


app.put('/api/clients/:id', async (request, response, next) => {
  try {
    const clientId = Number(request.params.id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      response.status(400).json({ message: 'ID client invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const nom = toNullableText(request.body.nom);
    const prenom = toNullableText(request.body.prenom);

    if (!nom || !prenom) {
      response.status(400).json({ message: 'nom et prenom sont obligatoires.' });
      return;
    }

    const email = toNullableText(request.body.email);
    const telephone = toNullableText(request.body.telephone);
    const responsableName = toNullableText(request.body.responsable) ?? sessionContext.user;
    const agenceId = await resolveAgenceIdForMutation(request.body.agence, sessionContext);
    if (agenceId === null) {
      response.status(403).json({ message: 'Aucune agence autorisee pour ce collaborateur.' });
      return;
    }
    const responsableId = await findCollaborateurId(responsableName);

    const result = await query(
      `
        UPDATE client
        SET id_agence = $1,
            id_collaborateur_responsable = $2,
            nom = $3,
            prenom = $4,
            email = $5,
            telephone = $6
        WHERE id = $7
        RETURNING id
      `,
      [agenceId, responsableId, nom, prenom, email, telephone, clientId],
    );

    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Client introuvable.' });
      return;
    }

    const row = await getClientById(clientId);
    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/clients/:id', async (request, response, next) => {
  try {
    const clientId = Number(request.params.id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      response.status(400).json({ message: 'ID client invalide.' });
      return;
    }

    try {
      const result = await query(
        `DELETE FROM client WHERE id = $1 RETURNING id`,
        [clientId],
      );

      if (result.rows.length === 0) {
        response.status(404).json({ message: 'Client introuvable.' });
        return;
      }

      response.status(204).end();
    } catch (dbError) {
      if (dbError.code === '23503') {
        response.status(409).json({ message: 'Impossible de supprimer : ce client possede des dossiers associes.' });
        return;
      }

      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/dossiers/:id', async (request, response, next) => {
  try {
    const dossierId = Number(request.params.id);
    if (!Number.isFinite(dossierId)) {
      response.status(400).json({ message: 'ID dossier invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Dossier introuvable.' });
      return;
    }

    const accessCheck = await query(
      `
        SELECT d.id_agence AS "agenceId"
        FROM dossier d
        LEFT JOIN client c ON c.id = d.id_client
        LEFT JOIN agence a ON a.id = d.id_agence
        WHERE d.id = $1
          AND ($2::text IS NULL OR a.id::text = $2 OR lower(a.nom) = lower($2) OR lower(a.ville) = lower($2))
          AND ($3::int IS NULL
            OR c.id_collaborateur_responsable = $3
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $3
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            ))
        LIMIT 1
      `,
      [dossierId, agenceFilter, collaborateurScope.collaborateurId],
    );

    if (!accessCheck.rows[0]) {
      response.status(404).json({ message: 'Dossier introuvable.' });
      return;
    }

    const row = await getDossierById(dossierId);
    if (!row) {
      response.status(404).json({ message: 'Dossier introuvable.' });
      return;
    }
    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.get('/api/dossiers', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const searchPattern = toSearchPattern(request.query.q);
    const statutFilter = toNullableText(request.query.statut);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.json([]);
      return;
    }

    const result = await query(
      `
        SELECT
          d.id,
          COALESCE(d.reference, '') AS reference,
          d.id_client AS "clientId",
          COALESCE(trim(concat_ws(' ', c.prenom, c.nom)), 'Non renseigne') AS client,
          d.id_type_dossier AS "typeId",
          COALESCE(td.libelle, 'Non renseigne') AS type,
          d.id_statut_dossier AS "statutId",
          COALESCE(sd.libelle, 'Non renseigne') AS statut,
          d.id_agence AS "agenceId",
          COALESCE(a.nom, a.ville, 'Non renseignee') AS agence,
          COALESCE(to_char(d.date_ouverture, 'YYYY-MM-DD'), '') AS ouverture,
          COALESCE(to_char(d.date_cloture, 'YYYY-MM-DD'), '') AS echeance,
          COALESCE(latest_facture.montant, 0)::float8 AS montant
        FROM dossier d
        LEFT JOIN client c ON c.id = d.id_client
        LEFT JOIN type_dossier td ON td.id = d.id_type_dossier
        LEFT JOIN statut_dossier sd ON sd.id = d.id_statut_dossier
        LEFT JOIN agence a ON a.id = d.id_agence
        LEFT JOIN LATERAL (
          SELECT montant
          FROM facture f
          WHERE f.id_dossier = d.id
          ORDER BY f.date_emission DESC NULLS LAST, f.id DESC
          LIMIT 1
        ) AS latest_facture ON true
        WHERE ($1::text IS NULL
          OR d.reference ILIKE $1
          OR c.nom ILIKE $1
          OR c.prenom ILIKE $1
          OR td.libelle ILIKE $1)
          AND ($2::text IS NULL OR sd.libelle = $2)
          AND ($3::text IS NULL OR a.id::text = $3 OR lower(a.nom) = lower($3) OR lower(a.ville) = lower($3))
          AND ($4::int IS NULL
            OR c.id_collaborateur_responsable = $4
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $4
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            ))
        ORDER BY d.id DESC
      `,
      [searchPattern, statutFilter, agenceFilter, collaborateurScope.collaborateurId],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/dossiers', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const reference = toNullableText(request.body.reference);
    const clientValue = toNullableText(request.body.client);

    if (!reference || !clientValue) {
      response.status(400).json({ message: 'reference et client sont obligatoires.' });
      return;
    }

    const agenceId = await resolveAgenceIdForMutation(request.body.agence, sessionContext);
    if (agenceId === null) {
      response.status(403).json({ message: 'Aucune agence autorisee pour ce collaborateur.' });
      return;
    }
    const clientId = await findOrCreateClientId(clientValue, agenceId);
    const typeId = await findOrCreateLabelId('type_dossier', request.body.type ?? 'Contentieux');
    const statutId = await findOrCreateLabelId('statut_dossier', request.body.statut ?? 'A valider');

    const dateOuverture = toNullableText(request.body.ouverture);
    const dateEcheance = toNullableText(request.body.echeance);
    const montant = Number(request.body.montant ?? 0);

    const inserted = await query(
      `
        INSERT INTO dossier (
          id_agence,
          id_client,
          id_type_dossier,
          id_statut_dossier,
          reference,
          date_ouverture,
          date_cloture
        )
        VALUES ($1, $2, $3, $4, $5, $6::date, $7::date)
        RETURNING id
      `,
      [agenceId, clientId, typeId, statutId, reference, dateOuverture, dateEcheance],
    );

    if (Number.isFinite(montant) && montant > 0) {
      await query(
        `
          INSERT INTO facture (id_dossier, montant, date_emission, statut)
          VALUES ($1, $2, CURRENT_DATE, 'Brouillon')
        `,
        [inserted.rows[0].id, montant],
      );
    }

    const row = await getDossierById(inserted.rows[0].id);
    response.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.put('/api/dossiers/:id', async (request, response, next) => {
  try {
    const dossierId = Number(request.params.id);
    if (!Number.isFinite(dossierId)) {
      response.status(400).json({ message: 'ID dossier invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Dossier introuvable.' });
      return;
    }

    const accessCheck = await query(
      `
        SELECT d.id_agence AS "agenceId"
        FROM dossier d
        LEFT JOIN client c ON c.id = d.id_client
        WHERE d.id = $1
          AND ($2::int IS NULL
            OR c.id_collaborateur_responsable = $2
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $2
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            ))
        LIMIT 1
      `,
      [dossierId, collaborateurScope.collaborateurId],
    );

    if (!accessCheck.rows[0]) {
      response.status(404).json({ message: 'Dossier introuvable.' });
      return;
    }

    const reference = toNullableText(request.body.reference);
    const clientValue = toNullableText(request.body.client);

    if (!reference || !clientValue) {
      response.status(400).json({ message: 'reference et client sont obligatoires.' });
      return;
    }

    const agenceId = accessCheck.rows[0].agenceId ?? null;
    const clientId = await findOrCreateClientId(clientValue, agenceId);
    const typeId = await findOrCreateLabelId('type_dossier', request.body.type ?? 'Contentieux');
    const statutId = await findOrCreateLabelId('statut_dossier', request.body.statut ?? 'A valider');

    const dateOuverture = toNullableText(request.body.ouverture);
    const dateEcheance = toNullableText(request.body.echeance);
    const montant = Number(request.body.montant ?? 0);

    await query(
      `
        UPDATE dossier
        SET id_agence = $1,
            id_client = $2,
            id_type_dossier = $3,
            id_statut_dossier = $4,
            reference = $5,
            date_ouverture = $6::date,
            date_cloture = $7::date
        WHERE id = $8
      `,
      [agenceId, clientId, typeId, statutId, reference, dateOuverture, dateEcheance, dossierId],
    );

    if (Number.isFinite(montant)) {
      const latestFacture = await query(
        `
          SELECT id
          FROM facture
          WHERE id_dossier = $1
          ORDER BY date_emission DESC NULLS LAST, id DESC
          LIMIT 1
        `,
        [dossierId],
      );

      if (latestFacture.rows[0]) {
        await query(
          `
            UPDATE facture
            SET montant = $2
            WHERE id = $1
          `,
          [latestFacture.rows[0].id, montant],
        );
      } else if (montant > 0) {
        await query(
          `
            INSERT INTO facture (id_dossier, montant, date_emission, statut)
            VALUES ($1, $2, CURRENT_DATE, 'Brouillon')
          `,
          [dossierId, montant],
        );
      }
    }

    const row = await getDossierById(dossierId);
    if (!row) {
      response.status(404).json({ message: 'Dossier introuvable.' });
      return;
    }
    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.get('/api/procedures', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.json([]);
      return;
    }

    const result = await query(
      `
        SELECT
          p.id,
          p.id_dossier AS "dossierId",
          COALESCE(d.reference, '') AS "dossierReference",
          p.id_type_procedure AS "typeId",
          COALESCE(tp.libelle, 'Non renseigne') AS type,
          p.id_statut_procedure AS "statutId",
          COALESCE(sp.libelle, 'Non renseigne') AS statut,
          COALESCE(latest_instance.juridiction, 'Instance') AS juridiction,
          COALESCE(to_char(p.date_debut, 'YYYY-MM-DD'), '') AS debut,
          COALESCE(to_char(p.date_fin, 'YYYY-MM-DD'), '') AS fin
        FROM "procedure" p
        LEFT JOIN dossier d ON d.id = p.id_dossier
        LEFT JOIN client c ON c.id = d.id_client
        LEFT JOIN agence a ON a.id = d.id_agence
        LEFT JOIN type_procedure tp ON tp.id = p.id_type_procedure
        LEFT JOIN statut_procedure sp ON sp.id = p.id_statut_procedure
        LEFT JOIN LATERAL (
          SELECT COALESCE(ti.libelle, 'Instance') AS juridiction
          FROM instance_juridique ij
          LEFT JOIN type_instance ti ON ti.id = ij.id_type_instance
          WHERE ij.id_procedure = p.id
          ORDER BY ij.id DESC
          LIMIT 1
        ) AS latest_instance ON true
        WHERE ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
          AND ($2::int IS NULL
            OR c.id_collaborateur_responsable = $2
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $2
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            )
            OR EXISTS (
              SELECT 1
              FROM affectation_procedure ap
              WHERE ap.id_procedure = p.id
                AND ap.id_collaborateur = $2
                AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
            ))
        ORDER BY p.id DESC
      `,
      [agenceFilter, collaborateurScope.collaborateurId],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/procedures/:id', async (request, response, next) => {
  try {
    const procedureId = Number(request.params.id);
    if (!Number.isFinite(procedureId)) {
      response.status(400).json({ message: 'ID procedure invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const accessGranted = await hasProcedureAccess(procedureId, agenceFilter, collaborateurScope.collaborateurId);
    if (!accessGranted) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const row = await getProcedureById(procedureId);
    if (!row) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.get('/api/procedures/:id/instances', async (request, response, next) => {
  try {
    const procedureId = Number(request.params.id);
    if (!Number.isFinite(procedureId)) {
      response.status(400).json({ message: 'ID procedure invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const accessGranted = await hasProcedureAccess(procedureId, agenceFilter, collaborateurScope.collaborateurId);
    if (!accessGranted) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const rows = await getProcedureInstancesByProcedureId(procedureId);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/procedures/:id/history', async (request, response, next) => {
  try {
    const procedureId = Number(request.params.id);
    if (!Number.isFinite(procedureId)) {
      response.status(400).json({ message: 'ID procedure invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const accessGranted = await hasProcedureAccess(procedureId, agenceFilter, collaborateurScope.collaborateurId);
    if (!accessGranted) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const rows = await getProcedureHistoryByProcedureId(procedureId);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.put('/api/procedures/:id', async (request, response, next) => {
  try {
    const procedureId = Number(request.params.id);
    if (!Number.isFinite(procedureId)) {
      response.status(400).json({ message: 'ID procedure invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const accessGranted = await hasProcedureAccess(procedureId, agenceFilter, collaborateurScope.collaborateurId);
    if (!accessGranted) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const previousProcedure = await getProcedureById(procedureId);
    if (!previousProcedure) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const typeLabel = toNullableText(request.body.type);
    const statutLabel = toNullableText(request.body.statut);
    if (!typeLabel || !statutLabel) {
      response.status(400).json({ message: 'type et statut sont obligatoires.' });
      return;
    }

    const typeId = await findOrCreateLabelId('type_procedure', typeLabel);
    const statutId = await findOrCreateLabelId('statut_procedure', statutLabel);
    const dateDebut = toNullableText(request.body.debut);
    const dateFin = toNullableText(request.body.fin);

    await query(
      `
        UPDATE "procedure"
        SET id_type_procedure = $1,
            id_statut_procedure = $2,
            date_debut = $3::date,
            date_fin = $4::date
        WHERE id = $5
      `,
      [typeId, statutId, dateDebut, dateFin, procedureId],
    );

    const row = await getProcedureById(procedureId);
    if (!row) {
      response.status(404).json({ message: 'Procedure introuvable.' });
      return;
    }

    const actorIdByEmail = await findCollaborateurIdByEmail(sessionContext.userEmail);
    const actorId = actorIdByEmail ?? await findCollaborateurId(sessionContext.user);
    const description = buildProcedureHistoryDescription(previousProcedure, row);

    await query(
      `
        INSERT INTO historique_procedure (id_procedure, auteur, date_modification, description)
        VALUES ($1, $2, NOW(), $3)
      `,
      [procedureId, actorId, description],
    );

    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.put('/api/instances/:id', async (request, response, next) => {
  try {
    const instanceId = Number(request.params.id);
    if (!Number.isFinite(instanceId)) {
      response.status(400).json({ message: 'ID instance invalide.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Instance introuvable.' });
      return;
    }

    const previousInstance = await getInstanceById(instanceId);
    if (!previousInstance) {
      response.status(404).json({ message: 'Instance introuvable.' });
      return;
    }

    const accessGranted = await hasProcedureAccess(previousInstance.procedureId, agenceFilter, collaborateurScope.collaborateurId);
    if (!accessGranted) {
      response.status(404).json({ message: 'Instance introuvable.' });
      return;
    }

    const typeLabel = toNullableText(request.body.type);
    const statutLabel = toNullableText(request.body.statut);
    if (!typeLabel || !statutLabel) {
      response.status(400).json({ message: 'type et statut sont obligatoires.' });
      return;
    }

    const typeId = await findOrCreateLabelId('type_instance', typeLabel);
    const statutId = await findOrCreateLabelId('statut_instance', statutLabel);
    const dateDebut = toNullableText(request.body.debut);
    const dateFin = toNullableText(request.body.fin);

    await query(
      `
        UPDATE instance_juridique
        SET id_type_instance = $1,
            id_statut_instance = $2,
            date_debut = $3::date,
            date_fin = $4::date
        WHERE id = $5
      `,
      [typeId, statutId, dateDebut, dateFin, instanceId],
    );

    const row = await getInstanceById(instanceId);
    if (!row) {
      response.status(404).json({ message: 'Instance introuvable.' });
      return;
    }

    const actorIdByEmail = await findCollaborateurIdByEmail(sessionContext.userEmail);
    const actorId = actorIdByEmail ?? await findCollaborateurId(sessionContext.user);
    const description = buildInstanceHistoryDescription(previousInstance, row);

    await query(
      `
        INSERT INTO historique_instance (id_instance, auteur, date_modification, description)
        VALUES ($1, $2, NOW(), $3)
      `,
      [instanceId, actorId, description],
    );

    response.json({
      id: row.id,
      type: row.type,
      statut: row.statut,
      debut: row.debut,
      fin: row.fin,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/audiences', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.json([]);
      return;
    }

    const preset = toNullableText(request.query.preset);
    const upcomingOnly = preset === 'upcoming7d';

    const result = await query(
      `
        SELECT
          aud.id,
          p.id AS "procedureId",
          d.id AS "dossierId",
          COALESCE(d.reference, '') AS "dossierReference",
          COALESCE(td.libelle, 'Non renseigne') AS "dossierType",
          COALESCE(tp.libelle, 'Procedure') AS "procedureType",
          COALESCE(sp.libelle, 'Non renseigne') AS "procedureStatut",
          COALESCE(ti.libelle, 'Instance') AS "instanceType",
          COALESCE(to_char(aud.date_audience, 'YYYY-MM-DD'), '') AS "dateAudience",
          COALESCE(aud.commentaire, '') AS commentaire
        FROM audience aud
        LEFT JOIN instance_juridique ij ON ij.id = aud.id_instance
        LEFT JOIN type_instance ti ON ti.id = ij.id_type_instance
        LEFT JOIN "procedure" p ON p.id = ij.id_procedure
        LEFT JOIN type_procedure tp ON tp.id = p.id_type_procedure
        LEFT JOIN statut_procedure sp ON sp.id = p.id_statut_procedure
        LEFT JOIN dossier d ON d.id = p.id_dossier
        LEFT JOIN type_dossier td ON td.id = d.id_type_dossier
        LEFT JOIN client c ON c.id = d.id_client
        LEFT JOIN agence a ON a.id = d.id_agence
        WHERE ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
          AND ($2::int IS NULL
            OR c.id_collaborateur_responsable = $2
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = d.id
                AND ad.id_collaborateur = $2
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            )
            OR EXISTS (
              SELECT 1
              FROM affectation_procedure ap
              WHERE ap.id_procedure = p.id
                AND ap.id_collaborateur = $2
                AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
            ))
          AND ($3::boolean = false OR aud.date_audience BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
        ORDER BY aud.date_audience ASC NULLS LAST, aud.id ASC
      `,
      [agenceFilter, collaborateurScope.collaborateurId, upcomingOnly],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/documents', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.json([]);
      return;
    }

    const result = await query(
      `
        SELECT
          doc.id,
          COALESCE(td.libelle, 'Document') AS type,
          doc.id_procedure AS "procedureId",
          doc.id_instance AS "instanceId",
          COALESCE(direct_dossier.reference, procedure_dossier.reference, instance_dossier.reference, '') AS "dossierReference",
          COALESCE(trim(concat_ws(' ', auteur_collab.prenom, auteur_collab.nom)), 'Non assigne') AS auteur,
          COALESCE(to_char(doc.date_creation, 'YYYY-MM-DD'), '') AS "dateCreation",
          COALESCE(doc.statut_document,
            CASE
              WHEN doc.date_creation IS NULL THEN 'Brouillon'
              WHEN doc.date_creation < NOW() - INTERVAL '30 days' THEN 'Valide'
              ELSE 'A relire'
            END
          ) AS statut,
          doc.id_modele AS "modeleId",
          doc.numero_version_modele AS "modeleVersion"
        FROM document doc
        LEFT JOIN type_document td ON td.id = doc.id_type_document
        LEFT JOIN dossier direct_dossier ON direct_dossier.id = doc.id_dossier
        LEFT JOIN "procedure" doc_procedure ON doc_procedure.id = doc.id_procedure
        LEFT JOIN dossier procedure_dossier ON procedure_dossier.id = doc_procedure.id_dossier
        LEFT JOIN instance_juridique doc_instance ON doc_instance.id = doc.id_instance
        LEFT JOIN "procedure" instance_procedure ON instance_procedure.id = doc_instance.id_procedure
        LEFT JOIN dossier instance_dossier ON instance_dossier.id = instance_procedure.id_dossier
        LEFT JOIN client c ON c.id = COALESCE(direct_dossier.id_client, procedure_dossier.id_client, instance_dossier.id_client)
        LEFT JOIN agence a ON a.id = COALESCE(direct_dossier.id_agence, procedure_dossier.id_agence, instance_dossier.id_agence)
        LEFT JOIN collaborateur auteur_collab ON auteur_collab.id = doc.auteur
        WHERE ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
          AND ($2::int IS NULL
            OR c.id_collaborateur_responsable = $2
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = COALESCE(direct_dossier.id, procedure_dossier.id, instance_dossier.id)
                AND ad.id_collaborateur = $2
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            )
            OR EXISTS (
              SELECT 1
              FROM affectation_procedure ap
              WHERE ap.id_procedure = COALESCE(doc.id_procedure, doc_instance.id_procedure)
                AND ap.id_collaborateur = $2
                AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
            ))
        ORDER BY doc.id DESC
      `,
      [agenceFilter, collaborateurScope.collaborateurId],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Aucun dossier accessible pour creer un document.' });
      return;
    }

    const typeId = await findOrCreateLabelId('type_document', request.body.type ?? 'Document');
    const dossierIdentifier = toNullableText(request.body.dossierReference);
    const auteurName = toNullableText(request.body.auteur) ?? sessionContext.user;
    const auteurId = await findCollaborateurId(auteurName);
    const statutDocument = toNullableText(request.body.statut) ?? 'brouillon';

    let dossierId = null;
    if (dossierIdentifier) {
      const dossier = await query(
        `
          SELECT id
          FROM dossier
          WHERE id::text = $1
             OR reference = $1
          ORDER BY id DESC
          LIMIT 1
        `,
        [dossierIdentifier],
      );
      dossierId = dossier.rows[0]?.id ?? null;
    }

    if (dossierId === null) {
      const fallbackDossier = await query(
        `
          SELECT d.id
          FROM dossier d
          LEFT JOIN client c ON c.id = d.id_client
          LEFT JOIN agence a ON a.id = d.id_agence
          WHERE ($1::text IS NULL OR a.id::text = $1 OR lower(a.nom) = lower($1) OR lower(a.ville) = lower($1))
            AND ($2::int IS NULL
              OR c.id_collaborateur_responsable = $2
              OR EXISTS (
                SELECT 1
                FROM affectation_dossier ad
                WHERE ad.id_dossier = d.id
                  AND ad.id_collaborateur = $2
                  AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
              )
              OR EXISTS (
                SELECT 1
                FROM affectation_procedure ap
                INNER JOIN "procedure" p ON p.id = ap.id_procedure
                WHERE p.id_dossier = d.id
                  AND ap.id_collaborateur = $2
                  AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
              ))
          ORDER BY d.id DESC
          LIMIT 1
        `,
        [agenceFilter, collaborateurScope.collaborateurId],
      );

      dossierId = fallbackDossier.rows[0]?.id ?? null;
    }

    if (dossierId === null) {
      response.status(400).json({ message: 'Aucun dossier disponible pour creer un document.' });
      return;
    }

    const inserted = await query(
      `
        INSERT INTO document (id_type_document, id_dossier, auteur, chemin_fichier, date_creation, statut_document)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING id
      `,
      [typeId, dossierId, auteurId, '/documents/local', statutDocument],
    );

    const row = await getDocumentById(inserted.rows[0].id);
    response.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.get('/api/modeles', async (request, response, next) => {
  try {
    const searchPattern = toSearchPattern(request.query.q);
    const typeDocumentId = toNullableText(request.query.typeDocumentId);
    const sousDomaineId = toNullableText(request.query.sousDomaineId);
    const publishedOnly = toBoolean(request.query.publishedOnly, false);

    const result = await query(
      `
        SELECT
          md.id,
          md.id_type_document AS "typeDocumentId",
          COALESCE(td.libelle, 'Document') AS "typeDocumentLabel",
          COALESCE(md.nom_modele, '') AS "nomModele",
          COALESCE(md.description, '') AS description,
          COALESCE(latest.numero_version, 0) AS "latestVersion",
          COALESCE(to_char(latest.cree_le, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS "latestVersionCreatedAt",
          (latest.id IS NOT NULL) AS published
        FROM modele_document md
        LEFT JOIN type_document td ON td.id = md.id_type_document
        LEFT JOIN LATERAL (
          SELECT id, numero_version, cree_le
          FROM modele_document_version
          WHERE id_modele = md.id
          ORDER BY numero_version DESC
          LIMIT 1
        ) AS latest ON true
        LEFT JOIN modele_sous_domaine msd ON msd.id_modele = md.id
        WHERE ($1::text IS NULL
          OR md.nom_modele ILIKE $1
          OR md.description ILIKE $1
          OR td.libelle ILIKE $1)
          AND ($2::text IS NULL OR md.id_type_document::text = $2)
          AND ($3::text IS NULL OR msd.id_sous_domaine::text = $3)
          AND ($4::boolean = false OR latest.id IS NOT NULL)
        GROUP BY md.id, td.libelle, latest.id, latest.numero_version, latest.cree_le
        ORDER BY md.id DESC
      `,
      [searchPattern, typeDocumentId, sousDomaineId, publishedOnly],
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/modeles/:id', async (request, response, next) => {
  try {
    const modeleId = Number(request.params.id);
    if (!Number.isFinite(modeleId)) {
      response.status(400).json({ message: 'ID modele invalide.' });
      return;
    }

    const modele = await getModeleById(modeleId);
    if (!modele) {
      response.status(404).json({ message: 'Modele introuvable.' });
      return;
    }

    const [sousDomainesResult, paragraphesResult, latestVersion] = await Promise.all([
      query(
        `
          SELECT id_sous_domaine AS "sousDomaineId"
          FROM modele_sous_domaine
          WHERE id_modele = $1
          ORDER BY id_sous_domaine ASC
        `,
        [modeleId],
      ),
      query(
        `
          SELECT id, COALESCE(ordre, 0) AS ordre, COALESCE(contenu, '') AS contenu
          FROM paragraphe_predefini
          WHERE id_modele = $1
          ORDER BY ordre ASC, id ASC
        `,
        [modeleId],
      ),
      getLatestModeleVersion(modeleId),
    ]);

    response.json({
      ...modele,
      sousDomaines: sousDomainesResult.rows.map((row) => row.sousDomaineId),
      paragraphes: paragraphesResult.rows,
      latestVersion,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/modeles', async (request, response, next) => {
  try {
    const nomModele = toNullableText(request.body.nomModele);
    const typeDocumentId = toNullableText(request.body.typeDocumentId);
    const description = toNullableText(request.body.description);
    const contenuJson = toJsonObject(request.body.contenuJson) ?? {};
    const sousDomaines = Array.isArray(request.body.sousDomaines) ? request.body.sousDomaines : [];
    const paragraphes = Array.isArray(request.body.paragraphes) ? request.body.paragraphes : [];

    if (!nomModele || !typeDocumentId) {
      response.status(400).json({ message: 'nomModele et typeDocumentId sont obligatoires.' });
      return;
    }

    const inserted = await query(
      `
        INSERT INTO modele_document (id_type_document, nom_modele, description, contenu_json)
        VALUES ($1::int, $2, $3, $4::jsonb)
        RETURNING id
      `,
      [typeDocumentId, nomModele, description, JSON.stringify(contenuJson)],
    );

    const modeleId = inserted.rows[0].id;

    await syncModeleSousDomaines(modeleId, sousDomaines, false);
    await syncModeleParagraphes(modeleId, paragraphes, false);

    const created = await getModeleById(modeleId);
    response.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put('/api/modeles/:id', async (request, response, next) => {
  try {
    const modeleId = Number(request.params.id);
    if (!Number.isFinite(modeleId)) {
      response.status(400).json({ message: 'ID modele invalide.' });
      return;
    }

    const existing = await getModeleById(modeleId);
    if (!existing) {
      response.status(404).json({ message: 'Modele introuvable.' });
      return;
    }

    const nomModele = toNullableText(request.body.nomModele) ?? existing.nomModele;
    const description = toNullableText(request.body.description) ?? '';
    const typeDocumentId = toNullableText(request.body.typeDocumentId) ?? String(existing.typeDocumentId);
    const contenuJson = toJsonObject(request.body.contenuJson) ?? existing.contenuJson ?? {};
    const sousDomaines = Array.isArray(request.body.sousDomaines) ? request.body.sousDomaines : null;
    const paragraphes = Array.isArray(request.body.paragraphes) ? request.body.paragraphes : null;

    await query(
      `
        UPDATE modele_document
        SET id_type_document = $1::int,
            nom_modele = $2,
            description = $3,
            contenu_json = $4::jsonb
        WHERE id = $5
      `,
      [typeDocumentId, nomModele, description, JSON.stringify(contenuJson), modeleId],
    );

    if (sousDomaines !== null) {
      await syncModeleSousDomaines(modeleId, sousDomaines, true);
    }

    if (paragraphes !== null) {
      await syncModeleParagraphes(modeleId, paragraphes, true);
    }

    const updated = await getModeleById(modeleId);
    response.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post('/api/modeles/:id/publish', async (request, response, next) => {
  try {
    const modeleId = Number(request.params.id);
    if (!Number.isFinite(modeleId)) {
      response.status(400).json({ message: 'ID modele invalide.' });
      return;
    }

    const modele = await getModeleById(modeleId);
    if (!modele) {
      response.status(404).json({ message: 'Modele introuvable.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const actorIdByEmail = await findCollaborateurIdByEmail(sessionContext.userEmail);
    const actorId = actorIdByEmail ?? await findCollaborateurId(sessionContext.user);

    const latestVersion = await getLatestModeleVersion(modeleId);
    const nextVersion = (latestVersion?.numeroVersion ?? 0) + 1;

    const inserted = await query(
      `
        INSERT INTO modele_document_version (id_modele, numero_version, contenu_json, cree_par)
        VALUES ($1, $2, $3::jsonb, $4)
        RETURNING id
      `,
      [modeleId, nextVersion, JSON.stringify(modele.contenuJson ?? {}), actorId],
    );

    const version = await query(
      `
        SELECT
          id,
          id_modele AS "modeleId",
          numero_version AS "numeroVersion",
          contenu_json AS "contenuJson",
          COALESCE(to_char(cree_le, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS "creeLe",
          cree_par AS "creePar"
        FROM modele_document_version
        WHERE id = $1
      `,
      [inserted.rows[0].id],
    );

    response.status(201).json(version.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/modeles/:id/versions', async (request, response, next) => {
  try {
    const modeleId = Number(request.params.id);
    if (!Number.isFinite(modeleId)) {
      response.status(400).json({ message: 'ID modele invalide.' });
      return;
    }

    const rows = await query(
      `
        SELECT
          mdv.id,
          mdv.id_modele AS "modeleId",
          mdv.numero_version AS "numeroVersion",
          mdv.contenu_json AS "contenuJson",
          COALESCE(to_char(mdv.cree_le, 'YYYY-MM-DD"T"HH24:MI:SS'), '') AS "creeLe",
          mdv.cree_par AS "creePar"
        FROM modele_document_version mdv
        WHERE mdv.id_modele = $1
        ORDER BY mdv.numero_version DESC
      `,
      [modeleId],
    );

    response.json(rows.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/modeles/:id/versions/:version', async (request, response, next) => {
  try {
    const modeleId = Number(request.params.id);
    const numeroVersion = Number(request.params.version);
    if (!Number.isFinite(modeleId) || !Number.isFinite(numeroVersion)) {
      response.status(400).json({ message: 'Parametres invalides.' });
      return;
    }

    const version = await getModeleVersion(modeleId, numeroVersion);
    if (!version) {
      response.status(404).json({ message: 'Version introuvable.' });
      return;
    }

    response.json(version);
  } catch (error) {
    next(error);
  }
});

app.post('/api/documents/generate', async (request, response, next) => {
  try {
    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);
    const modeId = Number(request.body.modeleId);
    const numeroVersion = Number(request.body.numeroVersion);
    const scopeType = toNullableText(request.body.scopeType);
    const scopeId = Number(request.body.scopeId);
    const typeDocumentIdRaw = toNullableText(request.body.typeDocumentId);
    const metadata = toJsonObject(request.body.variables) ?? {};

    if (!Number.isFinite(modeId) || !Number.isFinite(numeroVersion) || !scopeType || !Number.isFinite(scopeId)) {
      response.status(400).json({ message: 'modeleId, numeroVersion, scopeType et scopeId sont obligatoires.' });
      return;
    }

    if (!ALLOWED_DOCUMENT_SCOPE_TYPES.has(scopeType)) {
      response.status(400).json({ message: 'scopeType invalide.' });
      return;
    }

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Contexte metier introuvable.' });
      return;
    }

    const version = await getModeleVersion(modeId, numeroVersion);
    if (!version) {
      response.status(404).json({ message: 'Version de modele introuvable.' });
      return;
    }

    const scope = await resolveDocumentScope(scopeType, scopeId, agenceFilter, collaborateurScope.collaborateurId);
    if (!scope) {
      response.status(404).json({ message: 'Contexte de generation introuvable ou non autorise.' });
      return;
    }

    const actorIdByEmail = await findCollaborateurIdByEmail(sessionContext.userEmail);
    const actorId = actorIdByEmail ?? await findCollaborateurId(sessionContext.user);
    const typeDocumentId = typeDocumentIdRaw && Number.isFinite(Number(typeDocumentIdRaw))
      ? Number(typeDocumentIdRaw)
      : null;

    const fakePath = `/documents/generated/modele-${modeId}-v${numeroVersion}-${Date.now()}.json`;

    const inserted = await query(
      `
        INSERT INTO document (
          id_type_document,
          id_dossier,
          id_procedure,
          id_instance,
          auteur,
          chemin_fichier,
          date_creation,
          id_modele,
          numero_version_modele,
          statut_document,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, 'brouillon', $9::jsonb)
        RETURNING id
      `,
      [
        typeDocumentId,
        scope.dossierId,
        scope.procedureId,
        scope.instanceId,
        actorId,
        fakePath,
        modeId,
        numeroVersion,
        JSON.stringify({
          variables: metadata,
          generatedFromVersion: version.contenuJson,
          scope,
        }),
      ],
    );

    const row = await getDocumentById(inserted.rows[0].id);
    response.status(201).json(row);
  } catch (error) {
    next(error);
  }
});

app.put('/api/documents/:id/status', async (request, response, next) => {
  try {
    const documentId = Number(request.params.id);
    if (!Number.isFinite(documentId)) {
      response.status(400).json({ message: 'ID document invalide.' });
      return;
    }

    const nextStatus = toNullableText(request.body.statut);
    if (!nextStatus) {
      response.status(400).json({ message: 'statut est obligatoire.' });
      return;
    }

    const sessionContext = getSessionContext(request);
    const agenceFilter = await resolveAgenceFilter(request.query.agence, sessionContext);
    const collaborateurScope = await resolveCollaborateurScope(sessionContext);

    if (collaborateurScope.restrictToCollaborateur && collaborateurScope.collaborateurId === null) {
      response.status(404).json({ message: 'Document introuvable.' });
      return;
    }

    const accessCheck = await query(
      `
        SELECT doc.id
        FROM document doc
        LEFT JOIN dossier direct_dossier ON direct_dossier.id = doc.id_dossier
        LEFT JOIN "procedure" doc_procedure ON doc_procedure.id = doc.id_procedure
        LEFT JOIN dossier procedure_dossier ON procedure_dossier.id = doc_procedure.id_dossier
        LEFT JOIN instance_juridique doc_instance ON doc_instance.id = doc.id_instance
        LEFT JOIN "procedure" instance_procedure ON instance_procedure.id = doc_instance.id_procedure
        LEFT JOIN dossier instance_dossier ON instance_dossier.id = instance_procedure.id_dossier
        LEFT JOIN client c ON c.id = COALESCE(direct_dossier.id_client, procedure_dossier.id_client, instance_dossier.id_client)
        LEFT JOIN agence a ON a.id = COALESCE(direct_dossier.id_agence, procedure_dossier.id_agence, instance_dossier.id_agence)
        WHERE doc.id = $1
          AND ($2::text IS NULL OR a.id::text = $2 OR lower(a.nom) = lower($2) OR lower(a.ville) = lower($2))
          AND ($3::int IS NULL
            OR c.id_collaborateur_responsable = $3
            OR EXISTS (
              SELECT 1
              FROM affectation_dossier ad
              WHERE ad.id_dossier = COALESCE(direct_dossier.id, procedure_dossier.id, instance_dossier.id)
                AND ad.id_collaborateur = $3
                AND (ad.date_fin IS NULL OR ad.date_fin >= CURRENT_DATE)
            )
            OR EXISTS (
              SELECT 1
              FROM affectation_procedure ap
              WHERE ap.id_procedure = COALESCE(doc.id_procedure, doc_instance.id_procedure)
                AND ap.id_collaborateur = $3
                AND (ap.date_fin IS NULL OR ap.date_fin >= CURRENT_DATE)
            ))
        LIMIT 1
      `,
      [documentId, agenceFilter, collaborateurScope.collaborateurId],
    );

    if (!accessCheck.rows[0]) {
      response.status(404).json({ message: 'Document introuvable.' });
      return;
    }

    await query(
      `
        UPDATE document
        SET statut_document = $2
        WHERE id = $1
      `,
      [documentId, nextStatus],
    );

    const row = await getDocumentById(documentId);
    response.json(row);
  } catch (error) {
    next(error);
  }
});

app.get('/api/schema/tables', async (request, response, next) => {
  try {
    const result = await query(
      `
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
    );

    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// =========================================================
// CRUD generique pour les tables de referentiel simples (id + libelle)
// =========================================================

const ALLOWED_SIMPLE_REF_TABLES = new Set([
  'statut_dossier',
  'type_dossier',
  'statut_procedure',
  'type_procedure',
  'statut_instance',
  'type_instance',
  'type_document',
]);

function registerSimpleLibelleRoutes(tableName) {
  app.post(`/api/${tableName}`, async (request, response, next) => {
    try {
      const libelle = toNullableText(request.body?.libelle);
      if (!libelle) {
        response.status(400).json({ message: 'Le libelle est requis.' });
        return;
      }

      const result = await query(
        `INSERT INTO ${tableName} (libelle) VALUES ($1) RETURNING id, libelle`,
        [libelle],
      );
      response.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.put(`/api/${tableName}/:id`, async (request, response, next) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        response.status(400).json({ message: 'ID invalide.' });
        return;
      }

      const libelle = toNullableText(request.body?.libelle);
      if (!libelle) {
        response.status(400).json({ message: 'Le libelle est requis.' });
        return;
      }

      const result = await query(
        `UPDATE ${tableName} SET libelle = $1 WHERE id = $2 RETURNING id, libelle`,
        [libelle, id],
      );

      if (result.rows.length === 0) {
        response.status(404).json({ message: 'Element introuvable.' });
        return;
      }

      response.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete(`/api/${tableName}/:id`, async (request, response, next) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        response.status(400).json({ message: 'ID invalide.' });
        return;
      }

      try {
        const result = await query(
          `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
          [id],
        );

        if (result.rows.length === 0) {
          response.status(404).json({ message: 'Element introuvable.' });
          return;
        }

        response.status(204).end();
      } catch (dbError) {
        if (dbError.code === '23503') {
          response.status(409).json({ message: 'Impossible de supprimer : cet element est utilise par d\'autres donnees.' });
          return;
        }

        throw dbError;
      }
    } catch (error) {
      next(error);
    }
  });
}

for (const table of ALLOWED_SIMPLE_REF_TABLES) {
  registerSimpleLibelleRoutes(table);
}

// =========================================================
// CRUD Agences
// =========================================================

app.get('/api/agence/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const result = await query(
      `SELECT id, nom, COALESCE(adresse, '') AS adresse, COALESCE(ville, '') AS ville, COALESCE(code_postal, '') AS "codePostal" FROM agence WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Agence introuvable.' });
      return;
    }

    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/agence', async (request, response, next) => {
  try {
    const nom = toNullableText(request.body?.nom);
    if (!nom) {
      response.status(400).json({ message: 'Le nom est requis.' });
      return;
    }

    const adresse = toNullableText(request.body?.adresse);
    const ville = toNullableText(request.body?.ville);
    const codePostal = toNullableText(request.body?.codePostal);

    const result = await query(
      `INSERT INTO agence (nom, adresse, ville, code_postal) VALUES ($1, $2, $3, $4) RETURNING id, nom, COALESCE(adresse, '') AS adresse, COALESCE(ville, '') AS ville, COALESCE(code_postal, '') AS "codePostal"`,
      [nom, adresse, ville, codePostal],
    );

    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put('/api/agence/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const nom = toNullableText(request.body?.nom);
    if (!nom) {
      response.status(400).json({ message: 'Le nom est requis.' });
      return;
    }

    const adresse = toNullableText(request.body?.adresse);
    const ville = toNullableText(request.body?.ville);
    const codePostal = toNullableText(request.body?.codePostal);

    const result = await query(
      `UPDATE agence SET nom = $1, adresse = $2, ville = $3, code_postal = $4 WHERE id = $5 RETURNING id, nom, COALESCE(adresse, '') AS adresse, COALESCE(ville, '') AS ville, COALESCE(code_postal, '') AS "codePostal"`,
      [nom, adresse, ville, codePostal, id],
    );

    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Agence introuvable.' });
      return;
    }

    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/agence/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    try {
      const result = await query(
        `DELETE FROM agence WHERE id = $1 RETURNING id`,
        [id],
      );

      if (result.rows.length === 0) {
        response.status(404).json({ message: 'Agence introuvable.' });
        return;
      }

      response.status(204).end();
    } catch (dbError) {
      if (dbError.code === '23503') {
        response.status(409).json({ message: 'Impossible de supprimer : cette agence est associee a des collaborateurs ou clients.' });
        return;
      }

      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

// =========================================================
// CRUD Metiers
// =========================================================

app.get('/api/metier', async (request, response, next) => {
  try {
    const result = await query(`SELECT id, libelle FROM metier ORDER BY libelle ASC`);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/metier', async (request, response, next) => {
  try {
    const libelle = toNullableText(request.body?.libelle);
    if (!libelle) {
      response.status(400).json({ message: 'Le libellé est requis.' });
      return;
    }

    const result = await query(
      `INSERT INTO metier (libelle) VALUES ($1) RETURNING id, libelle`,
      [libelle],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put('/api/metier/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const libelle = toNullableText(request.body?.libelle);
    if (!libelle) {
      response.status(400).json({ message: 'Le libellé est requis.' });
      return;
    }

    const result = await query(
      `UPDATE metier SET libelle = $1 WHERE id = $2 RETURNING id, libelle`,
      [libelle, id],
    );

    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Métier introuvable.' });
      return;
    }

    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/metier/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    try {
      const result = await query(`DELETE FROM metier WHERE id = $1 RETURNING id`, [id]);
      if (result.rows.length === 0) {
        response.status(404).json({ message: 'Métier introuvable.' });
        return;
      }
      response.status(204).end();
    } catch (dbError) {
      if (dbError.code === '23503') {
        response.status(409).json({ message: 'Impossible de supprimer : ce métier est associé à des collaborateurs.' });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

// =========================================================
// CRUD Collaborateurs
// =========================================================

app.get('/api/collaborateur', async (request, response, next) => {
  try {
    const result = await query(
      `SELECT c.id,
              COALESCE(c.nom, '')       AS nom,
              COALESCE(c.prenom, '')    AS prenom,
              COALESCE(c.email, '')     AS email,
              COALESCE(c.telephone, '') AS telephone,
              c.id_agence               AS "agenceId",
              COALESCE(a.nom, '')       AS "agenceNom",
              c.id_metier               AS "metierId",
              COALESCE(m.libelle, '')   AS "metierLabel",
              c.date_entree             AS "dateEntree",
              c.actif
         FROM collaborateur c
         LEFT JOIN agence a ON a.id = c.id_agence
         LEFT JOIN metier m ON m.id = c.id_metier
        ORDER BY c.nom ASC, c.prenom ASC`,
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/collaborateur', async (request, response, next) => {
  try {
    const nom = toNullableText(request.body?.nom);
    const prenom = toNullableText(request.body?.prenom);
    if (!nom) {
      response.status(400).json({ message: 'Le nom est requis.' });
      return;
    }

    const email = toNullableText(request.body?.email);
    const telephone = toNullableText(request.body?.telephone);
    const agenceId = request.body?.agenceId ? Number(request.body.agenceId) : null;
    const metierId = request.body?.metierId ? Number(request.body.metierId) : null;
    const dateEntree = toNullableText(request.body?.dateEntree);
    const actif = request.body?.actif !== undefined ? Boolean(request.body.actif) : true;

    const result = await query(
      `INSERT INTO collaborateur (nom, prenom, email, telephone, id_agence, id_metier, date_entree, actif)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id,
                   COALESCE(nom, '')       AS nom,
                   COALESCE(prenom, '')    AS prenom,
                   COALESCE(email, '')     AS email,
                   COALESCE(telephone, '') AS telephone,
                   id_agence               AS "agenceId",
                   id_metier               AS "metierId",
                   date_entree             AS "dateEntree",
                   actif`,
      [nom, prenom, email, telephone, agenceId, metierId, dateEntree || null, actif],
    );

    const row = result.rows[0];
    // Resolve labels for the response
    const agenceRow = row.agenceId ? (await query(`SELECT nom FROM agence WHERE id = $1`, [row.agenceId])).rows[0] : null;
    const metierRow = row.metierId ? (await query(`SELECT libelle FROM metier WHERE id = $1`, [row.metierId])).rows[0] : null;

    response.status(201).json({
      ...row,
      agenceNom: agenceRow?.nom ?? '',
      metierLabel: metierRow?.libelle ?? '',
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/collaborateur/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const nom = toNullableText(request.body?.nom);
    if (!nom) {
      response.status(400).json({ message: 'Le nom est requis.' });
      return;
    }

    const prenom = toNullableText(request.body?.prenom);
    const email = toNullableText(request.body?.email);
    const telephone = toNullableText(request.body?.telephone);
    const agenceId = request.body?.agenceId ? Number(request.body.agenceId) : null;
    const metierId = request.body?.metierId ? Number(request.body.metierId) : null;
    const dateEntree = toNullableText(request.body?.dateEntree);
    const actif = request.body?.actif !== undefined ? Boolean(request.body.actif) : true;

    const result = await query(
      `UPDATE collaborateur
            SET nom = $1, prenom = $2, email = $3, telephone = $4,
                id_agence = $5, id_metier = $6, date_entree = $7, actif = $8
          WHERE id = $9
         RETURNING id,
                   COALESCE(nom, '')       AS nom,
                   COALESCE(prenom, '')    AS prenom,
                   COALESCE(email, '')     AS email,
                   COALESCE(telephone, '') AS telephone,
                   id_agence               AS "agenceId",
                   id_metier               AS "metierId",
                   date_entree             AS "dateEntree",
                   actif`,
      [nom, prenom, email, telephone, agenceId, metierId, dateEntree || null, actif, id],
    );

    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Collaborateur introuvable.' });
      return;
    }

    const row = result.rows[0];
    const agenceRow = row.agenceId ? (await query(`SELECT nom FROM agence WHERE id = $1`, [row.agenceId])).rows[0] : null;
    const metierRow = row.metierId ? (await query(`SELECT libelle FROM metier WHERE id = $1`, [row.metierId])).rows[0] : null;

    response.json({
      ...row,
      agenceNom: agenceRow?.nom ?? '',
      metierLabel: metierRow?.libelle ?? '',
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/collaborateur/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    try {
      const result = await query(`DELETE FROM collaborateur WHERE id = $1 RETURNING id`, [id]);
      if (result.rows.length === 0) {
        response.status(404).json({ message: 'Collaborateur introuvable.' });
        return;
      }
      response.status(204).end();
    } catch (dbError) {
      if (dbError.code === '23503') {
        response.status(409).json({ message: 'Impossible de supprimer : ce collaborateur est référencé dans des dossiers ou documents.' });
        return;
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

// =========================================================
// Rôles d'affectation
// =========================================================

app.get('/api/role-affectation', async (request, response, next) => {
  try {
    const result = await query(`SELECT id, libelle FROM role_affectation ORDER BY libelle`);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// =========================================================
// Affectations d'un collaborateur (dossiers + procédures)
// =========================================================

app.get('/api/collaborateur/:id/affectations', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const dossiers = await query(
      `SELECT ad.id,
              d.id AS "dossierId",
              d.reference AS "dossierReference",
              COALESCE(concat_ws(' ', cl.prenom, cl.nom), '') AS "dossierClient",
              ra.id AS "roleId",
              COALESCE(ra.libelle, '') AS "roleLibelle",
              to_char(ad.date_debut, 'YYYY-MM-DD') AS "dateDebut",
              to_char(ad.date_fin, 'YYYY-MM-DD') AS "dateFin"
         FROM affectation_dossier ad
         JOIN dossier d ON d.id = ad.id_dossier
         LEFT JOIN client cl ON cl.id = d.id_client
         LEFT JOIN role_affectation ra ON ra.id = ad.id_role
        WHERE ad.id_collaborateur = $1
        ORDER BY ad.date_debut DESC NULLS LAST`,
      [id],
    );

    const procedures = await query(
      `SELECT ap.id,
              p.id AS "procedureId",
              COALESCE(tp.libelle, '') AS "procedureType",
              d.reference AS "dossierReference",
              ra.id AS "roleId",
              COALESCE(ra.libelle, '') AS "roleLibelle",
              to_char(ap.date_debut, 'YYYY-MM-DD') AS "dateDebut",
              to_char(ap.date_fin, 'YYYY-MM-DD') AS "dateFin"
         FROM affectation_procedure ap
         JOIN procedure p ON p.id = ap.id_procedure
         JOIN dossier d ON d.id = p.id_dossier
         LEFT JOIN type_procedure tp ON tp.id = p.id_type_procedure
         LEFT JOIN role_affectation ra ON ra.id = ap.id_role
        WHERE ap.id_collaborateur = $1
        ORDER BY ap.date_debut DESC NULLS LAST`,
      [id],
    );

    response.json({ dossiers: dossiers.rows, procedures: procedures.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/collaborateur/:id/affectation-dossier', async (request, response, next) => {
  try {
    const collaborateurId = Number(request.params.id);
    if (!Number.isInteger(collaborateurId) || collaborateurId <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const dossierId = request.body?.dossierId ? Number(request.body.dossierId) : null;
    if (!dossierId) {
      response.status(400).json({ message: 'Le dossier est requis.' });
      return;
    }

    const roleId = request.body?.roleId ? Number(request.body.roleId) : null;
    const dateDebut = toNullableText(request.body?.dateDebut);
    const dateFin = toNullableText(request.body?.dateFin);

    const ins = await query(
      `INSERT INTO affectation_dossier (id_collaborateur, id_dossier, id_role, date_debut, date_fin)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [collaborateurId, dossierId, roleId, dateDebut || null, dateFin || null],
    );

    const row = await query(
      `SELECT ad.id,
              d.id AS "dossierId",
              d.reference AS "dossierReference",
              COALESCE(concat_ws(' ', cl.prenom, cl.nom), '') AS "dossierClient",
              ra.id AS "roleId",
              COALESCE(ra.libelle, '') AS "roleLibelle",
              to_char(ad.date_debut, 'YYYY-MM-DD') AS "dateDebut",
              to_char(ad.date_fin, 'YYYY-MM-DD') AS "dateFin"
         FROM affectation_dossier ad
         JOIN dossier d ON d.id = ad.id_dossier
         LEFT JOIN client cl ON cl.id = d.id_client
         LEFT JOIN role_affectation ra ON ra.id = ad.id_role
        WHERE ad.id = $1`,
      [ins.rows[0].id],
    );

    response.status(201).json(row.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/affectation-dossier/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const result = await query(`DELETE FROM affectation_dossier WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Affectation introuvable.' });
      return;
    }

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/collaborateur/:id/affectation-procedure', async (request, response, next) => {
  try {
    const collaborateurId = Number(request.params.id);
    if (!Number.isInteger(collaborateurId) || collaborateurId <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const procedureId = request.body?.procedureId ? Number(request.body.procedureId) : null;
    if (!procedureId) {
      response.status(400).json({ message: 'La procédure est requise.' });
      return;
    }

    const roleId = request.body?.roleId ? Number(request.body.roleId) : null;
    const dateDebut = toNullableText(request.body?.dateDebut);
    const dateFin = toNullableText(request.body?.dateFin);

    const ins = await query(
      `INSERT INTO affectation_procedure (id_collaborateur, id_procedure, id_role, date_debut, date_fin)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [collaborateurId, procedureId, roleId, dateDebut || null, dateFin || null],
    );

    const row = await query(
      `SELECT ap.id,
              p.id AS "procedureId",
              COALESCE(tp.libelle, '') AS "procedureType",
              d.reference AS "dossierReference",
              ra.id AS "roleId",
              COALESCE(ra.libelle, '') AS "roleLibelle",
              to_char(ap.date_debut, 'YYYY-MM-DD') AS "dateDebut",
              to_char(ap.date_fin, 'YYYY-MM-DD') AS "dateFin"
         FROM affectation_procedure ap
         JOIN procedure p ON p.id = ap.id_procedure
         JOIN dossier d ON d.id = p.id_dossier
         LEFT JOIN type_procedure tp ON tp.id = p.id_type_procedure
         LEFT JOIN role_affectation ra ON ra.id = ap.id_role
        WHERE ap.id = $1`,
      [ins.rows[0].id],
    );

    response.status(201).json(row.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/affectation-procedure/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      response.status(400).json({ message: 'ID invalide.' });
      return;
    }

    const result = await query(`DELETE FROM affectation_procedure WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      response.status(404).json({ message: 'Affectation introuvable.' });
      return;
    }

    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use(express.static(distPath));
app.get(/^(?!\/api(?:\/|$)).*/, (request, response) => {
  response.sendFile(path.join(distPath, 'index.html'));
});

app.use((error, request, response, next) => {
  console.error('[api] Error:', error.message);
  response.status(500).json({ message: error.message });
});

// --- Démarrage du serveur Express ---
app.listen(apiPort, async () => {
  try {
    await testConnection();
    console.log(`[api] Running on port ${apiPort} (PostgreSQL connected)`);
  } catch (error) {
    console.warn(`[api] Running on port ${apiPort} (PostgreSQL unavailable: ${error.message})`);
  }
});
