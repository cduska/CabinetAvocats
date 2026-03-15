describe('Creation dossier avec assistant', () => {
  it('cree un dossier en 2 etapes', () => {
    cy.visit('/dossiers');

    cy.get('[data-cy="add-dossier"]').click({ force: true });
    cy.get('.drawer').should('be.visible');

    cy.get('.drawer').within(() => {
      cy.get('input[placeholder="DOS-2026-006"]').type('DOS-2026-999');
      cy.get('input[placeholder="Prenom Nom"]').type('Test Client');
      cy.contains('button', 'Continuer').click();

      cy.get('input[type="date"]').type('2026-12-15');
      cy.contains('button', 'Creer').click();
    });

    cy.contains('DOS-2026-999').should('be.visible');
  });
});
