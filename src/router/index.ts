import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';
import DashboardPage from '../pages/DashboardPage.vue';
import ClientsPage from '../pages/ClientsPage.vue';
import DossiersPage from '../pages/DossiersPage.vue';
import DocumentsPage from '../pages/DocumentsPage.vue';
import ModelesPage from '../pages/ModelesPage.vue';
import AudiencesPage from '../pages/AudiencesPage.vue';
import SchemaPage from '../pages/SchemaPage.vue';
import ParametragePage from '../pages/ParametragePage.vue';
import { getFirstAccessibleRoute, isRouteName, routeAccessMatrix } from '../services/access';
import { getCurrentMetier } from '../services/session';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: '/dashboard',
        name: 'dashboard',
        component: DashboardPage,
        meta: {
          title: 'Dashboard',
          allowedMetiers: routeAccessMatrix.dashboard,
        },
      },
      {
        path: '/clients',
        name: 'clients',
        component: ClientsPage,
        meta: {
          title: 'Clients',
          allowedMetiers: routeAccessMatrix.clients,
        },
      },
      {
        path: '/dossiers',
        name: 'dossiers',
        component: DossiersPage,
        meta: {
          title: 'Dossiers',
          allowedMetiers: routeAccessMatrix.dossiers,
        },
      },
      {
        path: '/dossiers/:id',
        name: 'dossier-detail',
        component: () => import('../pages/DossierDetailPage.vue'),
        meta: {
          title: 'Détail Dossier',
          allowedMetiers: routeAccessMatrix.dossiers,
        },
      },
      {
        path: '/audiences',
        name: 'audiences',
        component: AudiencesPage,
        meta: {
          title: 'Audiences',
          allowedMetiers: routeAccessMatrix.audiences,
        },
      },
      {
        path: '/modeles',
        name: 'modeles',
        component: ModelesPage,
        meta: {
          title: 'Modeles',
          allowedMetiers: routeAccessMatrix.modeles,
        },
      },
      {
        path: '/procedures/:id',
        name: 'procedure-detail',
        component: () => import('../pages/ProcedureDetailPage.vue'),
        meta: {
          title: 'Detail Procedure',
          allowedMetiers: routeAccessMatrix['procedure-detail'],
        },
      },
      {
        path: '/documents',
        name: 'documents',
        component: DocumentsPage,
        meta: {
          title: 'Documents',
          allowedMetiers: routeAccessMatrix.documents,
        },
      },
      {
        path: '/schema',
        name: 'schema',
        component: SchemaPage,
        meta: {
          title: 'Schema',
          allowedMetiers: routeAccessMatrix.schema,
        },
      },
      {
        path: '/parametrage',
        name: 'parametrage',
        component: ParametragePage,
        meta: {
          title: 'Parametrage',
          allowedMetiers: routeAccessMatrix.parametrage,
        },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  if (!isRouteName(to.name)) {
    return true;
  }

  const metier = getCurrentMetier();
  const allowedMetiers = to.meta.allowedMetiers as readonly string[] | undefined;

  if (!allowedMetiers || allowedMetiers.includes(metier)) {
    return true;
  }

  return { name: getFirstAccessibleRoute(metier) };
});

export default router;
