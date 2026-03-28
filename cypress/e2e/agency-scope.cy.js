describe('Restriction agence collaborateur', () => {
  it('limite les clients a l agence du collaborateur', () => {
    cy.visit('/dashboard');

    cy.get('[data-cy="session-agency"]').select('paris');
    cy.get('[data-cy="session-metier"]').select('Collaborateur');
    cy.get('[data-cy="session-user"]').select('Hugo Dubois');

    cy.intercept('GET', '**/api/clients*').as('getClients');
    cy.get('[data-cy="nav-clients"]').click();

    cy.wait('@getClients').then(({ response }) => {
      expect(response?.statusCode).to.eq(200);
      const payload = Array.isArray(response?.body) ? response.body : [];
      const agencies = [...new Set(payload.map((client) => String(client.agence || '').trim()).filter(Boolean))];
      expect(agencies.length).to.be.lte(1);
    });
  });
});
