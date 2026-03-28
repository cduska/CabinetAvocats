describe('Workflow statut document', () => {
  it('cree un document puis met a jour son statut depuis la table', () => {
    const uniqueType = `Doc Cypress ${Date.now()}`;

    cy.intercept('GET', '**/api/documents*').as('getDocuments');
    cy.intercept('POST', '**/api/documents').as('createDocument');
    cy.intercept('PUT', '**/api/documents/*/status').as('updateDocumentStatus');

    cy.visit('/documents');
    cy.get('[data-cy="documents-page"]').should('be.visible');
    cy.wait('@getDocuments');

    cy.contains('button', 'Nouveau document').click();
    cy.get('.drawer').should('be.visible');

    cy.get('.drawer').within(() => {
      cy.contains('label', 'Type').find('input').clear().type(uniqueType);
      cy.contains('label', 'Auteur').find('input').clear().type('Cypress Testeur');
      cy.contains('label', 'Statut').find('input').clear().type('brouillon');
      cy.contains('button', 'Ajouter').click();
    });

    cy.wait('@createDocument').then(({ request, response }) => {
      expect(request.body.type).to.eq(uniqueType);
      expect(response?.statusCode).to.eq(201);
    });

    cy.contains('tr', uniqueType).as('createdDocumentRow');
    cy.get('@createdDocumentRow').within(() => {
      cy.get('select.status-select').select('valide', { force: true });
    });

    cy.wait('@updateDocumentStatus').then(({ request, response }) => {
      expect(request.body.statut).to.eq('valide');
      expect(response?.statusCode).to.eq(200);
      expect(response?.body?.statut).to.eq('valide');
    });

    cy.get('@createdDocumentRow').should('contain.text', 'valide');
  });
});