export const API_URL = 'https://tryingpos.com';

export const ENDPOINTS = {
  login: '/api/auth/login',
  me: '/api/auth/me',
  categories: '/api/categories',
  menuItems: '/api/menu-items',
  orders: '/api/orders',
  branches: '/api/branches',
  tables: '/api/tables',
  customers: '/api/customers',
  daySession: '/api/day-session',
  restaurant: '/api/restaurant',
  notifications: '/api/notifications',
  invoices: '/api/invoices',
} as const;
