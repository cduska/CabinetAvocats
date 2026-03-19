describe('Creation dossier avec assistant', () => {
  it('cree un dossier en 2 etapes', () => {
    cy.visit('/dossiers');

    cy.get('[data-cy="add-dossier"]').click({ force: true });
    cy.get('.drawer').should('be.visible');

    cy.get('.drawer').within(() => {
      cy.get('input[placeholder="DOS-2026-006"]').type('DOS-2026-999');

      cy.contains('label', 'Client principal').find('select').within(() => {
        cy.get('option').should('have.length.greaterThan', 1);
      });
      cy.contains('label', 'Client principal').find('select').select(1);

      cy.contains('label', 'Type de dossier').find('select').within(() => {
        cy.get('option').should('have.length.greaterThan', 1);
      });
      cy.contains('label', 'Type de dossier').find('select').select(1);

      cy.contains('button', 'Continuer').click();

      cy.contains('label', 'Statut').find('select').select(1);
      cy.contains('label', 'Agence').find('select').select(1);
      cy.get('input[type="date"]').type('2026-12-15');
      cy.contains('button', 'Creer').click();
    });

    cy.contains('DOS-2026-999').should('be.visible');
  });
});
