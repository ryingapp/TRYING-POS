import { API_URL, ENDPOINTS } from '../config/api';
import type { User, Branch, Category, MenuItem, Order } from '../types';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 2
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle rate limiting with retry + backoff
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '3', 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.request<T>(endpoint, options, retries - 1);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ==================== AUTH ====================

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    return this.request(ENDPOINTS.login, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<{ user: User }> {
    return this.request(ENDPOINTS.me);
  }

  // ==================== DATA ====================

  async getBranches(): Promise<Branch[]> {
    return this.request(ENDPOINTS.branches);
  }

  async getCategories(): Promise<Category[]> {
    return this.request(ENDPOINTS.categories);
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return this.request(ENDPOINTS.menuItems);
  }

  async getOrders(branchId?: string, period: string = 'today'): Promise<Order[]> {
    const params = branchId ? `?branch=${branchId}&period=${period}` : `?period=${period}`;
    return this.request(`${ENDPOINTS.orders}${params}`);
  }

  // ==================== ORDERS ====================

  async createOrder(data: any): Promise<Order> {
    return this.request(ENDPOINTS.orders, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createOrderItem(orderId: string, item: {
    menuItemId: string;
    itemName?: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    notes?: string;
  }): Promise<any> {
    return this.request(`${ENDPOINTS.orders}/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async getOrderItems(orderId: string): Promise<any[]> {
    return this.request(`${ENDPOINTS.orders}/${orderId}/items`);
  }

  async updateOrderStatus(
    orderId: string,
    status: string,
    reason?: string
  ): Promise<Order> {
    return this.request(`${ENDPOINTS.orders}/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  }

  async updateOrderPayment(
    orderId: string,
    paymentMethod: string,
    isPaid: boolean
  ): Promise<void> {
    await this.request(`${ENDPOINTS.orders}/${orderId}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ paymentMethod, isPaid }),
    });
  }

  // ==================== CONNECTIVITY ====================

  async createInvoice(data: any): Promise<any> {
    return this.request(ENDPOINTS.invoices, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInvoiceByOrder(orderId: string): Promise<any> {
    return this.request(`${ENDPOINTS.orders}/${orderId}/invoice`);
  }

  async getInvoice(invoiceId: string): Promise<any> {
    return this.request(`${ENDPOINTS.invoices}/${invoiceId}`);
  }

  async refundInvoice(invoiceId: string, reason: string): Promise<any> {
    return this.request(`${ENDPOINTS.invoices}/${invoiceId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Convenience: fetch invoice for order then refund it
  async refundOrder(orderId: string, reason: string): Promise<any> {
    const invoice = await this.getInvoiceByOrder(orderId);
    if (!invoice?.id) throw new Error('لم يتم العثور على فاتورة لهذا الطلب');
    return this.refundInvoice(invoice.id, reason);
  }

  async getRestaurant(): Promise<any> {
    return this.request(ENDPOINTS.restaurant);
  }

  async getSoftposToken(): Promise<{ authToken: string | null; environment: string }> {
    return this.request('/api/edfapay/softpos-token');
  }

  async checkServer(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      await fetch(`${API_URL}/api/auth/me`, {
        signal: ctrl.signal,
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
      });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }
}

export const api = new ApiService();
