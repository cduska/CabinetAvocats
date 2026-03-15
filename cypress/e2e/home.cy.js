describe('Accueil', () => {
  it('affiche le titre', () => {
    cy.visit('/');
    cy.contains("Gestion Cabinet d'Avocats");
  });
});
