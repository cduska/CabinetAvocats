describe('Navigation intranet', () => {
  it('affiche dashboard puis ouvre clients', () => {
    cy.visit('/');

    cy.contains('h1', 'Dashboard').should('be.visible');
    cy.get('[data-cy="sidebar"]').should('be.visible');

    cy.get('[data-cy="nav-clients"]').click();
    cy.contains('h1', 'Clients').should('be.visible');
    cy.get('[data-cy="clients-page"]').should('be.visible');
  });
});
