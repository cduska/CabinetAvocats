import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import MainLayout from '../layouts/MainLayout.vue';
import DashboardPage from '../pages/DashboardPage.vue';
import ClientsPage from '../pages/ClientsPage.vue';
import DossiersPage from '../pages/DossiersPage.vue';
import DocumentsPage from '../pages/DocumentsPage.vue';
import ProceduresPage from '../pages/ProceduresPage.vue';
import SchemaPage from '../pages/SchemaPage.vue';

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
        },
      },
      {
        path: '/clients',
        name: 'clients',
        component: ClientsPage,
        meta: {
          title: 'Clients',
        },
      },
      {
        path: '/dossiers',
        name: 'dossiers',
        component: DossiersPage,
        meta: {
          title: 'Dossiers',
        },
      },
      {
        path: '/procedures',
        name: 'procedures',
        component: ProceduresPage,
        meta: {
          title: 'Procedures',
        },
      },
      {
        path: '/documents',
        name: 'documents',
        component: DocumentsPage,
        meta: {
          title: 'Documents',
        },
      },
      {
        path: '/schema',
        name: 'schema',
        component: SchemaPage,
        meta: {
          title: 'Schema',
        },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
