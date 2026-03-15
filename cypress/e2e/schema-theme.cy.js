describe('Schema et mode sombre', () => {
  it('filtre le schema puis bascule le theme', () => {
    cy.visit('/schema');

    cy.get('input[aria-label="Recherche schema"]').type('dossier_lock');
    cy.contains('h3', 'dossier_lock').should('be.visible');

    cy.get('[data-cy="theme-toggle"]').click();
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });
});
