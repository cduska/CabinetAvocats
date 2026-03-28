function setCollaborateurParisSession() {
  cy.visit('/dashboard');
  cy.get('[data-cy="session-agency"]').select('paris');
  cy.get('[data-cy="session-metier"]').select('Collaborateur');
  cy.get('[data-cy="session-user"]').select('Hugo Dubois');
}

function expectSingleAgencyInResponse(body, fieldName) {
  const payload = Array.isArray(body) ? body : [];
  const agencies = [...new Set(payload.map((item) => String(item[fieldName] || '').trim()).filter(Boolean))];
  expect(agencies.length).to.be.lte(1);
}

describe('Restriction agence collaborateur - dossiers et documents', () => {

  it('limite les dossiers a une seule agence autorisee', () => {
    setCollaborateurParisSession();

    cy.intercept('GET', '**/api/dossiers*', (req) => {
      delete req.headers['if-none-match'];
      req.continue();
    }).as('getDossiers');
    cy.get('[data-cy="nav-dossiers"]').click();
    cy.get('[data-cy="dossiers-page"]').should('be.visible');

    cy.wait('@getDossiers').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      expectSingleAgencyInResponse(response?.body, 'agence');
    });
  });

  it('limite les documents a une seule agence autorisee', () => {
    setCollaborateurParisSession();

    cy.intercept('GET', '**/api/dossiers*', (req) => {
      delete req.headers['if-none-match'];
      req.continue();
    }).as('getScopedDossiers');
    cy.intercept('GET', '**/api/documents*', (req) => {
      delete req.headers['if-none-match'];
      req.continue();
    }).as('getDocuments');
    cy.get('[data-cy="nav-documents"]').click();
    cy.get('[data-cy="documents-page"]').should('be.visible');

    cy.wait('@getScopedDossiers').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      const dossiers = Array.isArray(response?.body) ? response.body : [];
      const allowedRefs = new Set(dossiers.map((dossier) => String(dossier.reference || '').trim()).filter(Boolean));

      cy.wait('@getDocuments').then(({ response: documentsResponse }) => {
        expect(documentsResponse?.statusCode).to.eq(200);
        const documents = Array.isArray(documentsResponse?.body) ? documentsResponse.body : [];
        documents.forEach((document) => {
          const ref = String(document.dossierReference || '').trim();
          if (ref) {
            expect(allowedRefs.has(ref)).to.eq(true);
          }
        });
      });
    });
  });
});
