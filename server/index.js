import express from 'express';
import dotenv from 'dotenv';
import { query, testConnection } from './db.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
const apiPort = Number(process.env.API_PORT || 8787);

app.use(express.json({ limit: '1mb' }));

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
        COALESCE(ds.reference, '') AS "dossierReference",
        COALESCE(trim(concat_ws(' ', c.prenom, c.nom)), 'Non assigne') AS auteur,
        COALESCE(to_char(d.date_creation, 'YYYY-MM-DD'), '') AS "dateCreation",
        CASE
          WHEN d.date_creation IS NULL THEN 'Brouillon'
          WHEN d.date_creation < NOW() - INTERVAL '30 days' THEN 'Valide'
          ELSE 'A relire'
        END AS statut
      FROM document d
      LEFT JOIN type_document td ON td.id = d.id_type_document
      LEFT JOIN dossier ds ON ds.id = d.id_dossier
      LEFT JOIN collaborateur c ON c.id = d.auteur
      WHERE d.id = $1
    `,
    [documentId],
  );

  return result.rows[0] ?? null;
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
    const result = await query(
      `
        SELECT id, nom
        FROM agence
        ORDER BY nom ASC, id ASC
      `,
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
    const agenceLabel = toNullableText(request.body.agence) ?? sessionContext.agence;
    const responsableName = toNullableText(request.body.responsable) ?? sessionContext.user;
    const agenceId = await findOrCreateAgenceId(agenceLabel);
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

    const agenceLabel = toNullableText(request.body.agence) ?? sessionContext.agence;
    const agenceId = await findOrCreateAgenceId(agenceLabel);
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
    response.json(row);
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
          COALESCE(direct_dossier.reference, procedure_dossier.reference, instance_dossier.reference, '') AS "dossierReference",
          COALESCE(trim(concat_ws(' ', auteur_collab.prenom, auteur_collab.nom)), 'Non assigne') AS auteur,
          COALESCE(to_char(doc.date_creation, 'YYYY-MM-DD'), '') AS "dateCreation",
          CASE
            WHEN doc.date_creation IS NULL THEN 'Brouillon'
            WHEN doc.date_creation < NOW() - INTERVAL '30 days' THEN 'Valide'
            ELSE 'A relire'
          END AS statut
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
    const typeId = await findOrCreateLabelId('type_document', request.body.type ?? 'Document');
    const dossierIdentifier = toNullableText(request.body.dossierReference);
    const auteurName = toNullableText(request.body.auteur) ?? sessionContext.user;
    const auteurId = await findCollaborateurId(auteurName);

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

    const inserted = await query(
      `
        INSERT INTO document (id_type_document, id_dossier, auteur, chemin_fichier, date_creation)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
      `,
      [typeId, dossierId, auteurId, '/documents/local'],
    );

    const row = await getDocumentById(inserted.rows[0].id);
    response.status(201).json(row);
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

app.use((error, request, response, next) => {
  console.error('[api] Error:', error.message);
  response.status(500).json({ message: error.message });
});

// --- Démarrage du serveur Express ---
app.listen(apiPort, async () => {
  try {
    await testConnection();
    console.log(`[api] Running on http://127.0.0.1:${apiPort} (PostgreSQL connected)`);
  } catch (error) {
    console.warn(`[api] Running on http://127.0.0.1:${apiPort} (PostgreSQL unavailable: ${error.message})`);
  }
});
