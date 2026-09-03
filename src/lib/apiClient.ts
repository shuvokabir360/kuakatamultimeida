const API_BASE_URL = typeof window !== 'undefined'
  ? (import.meta.env.VITE_API_URL || '/api')
  : (process.env.VITE_API_URL || 'http://127.0.0.1:5000/api');


const getHeaders = (isFormData = false) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('km_token') : null;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(isFormData),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `HTTP error! status: ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.error) errorMessage = errorData.error;
    } catch (_) {}
    throw new Error(errorMessage);
  }

  return res.json();
}

export const apiClient = {
  // Auth
  auth: {
    login: (body: { email: string; password: string }) =>
      request<{ user: any; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    register: (body: any) =>
      request<{ user: any; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    me: () => request<{ user: any }>('/auth/me'),
    hasRole: (role: string = 'admin') =>
      request<{ has_role: boolean }>(`/auth/has-role?role=${encodeURIComponent(role)}`),
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('km_token');
        localStorage.removeItem('km_user');
      }
    },
  },

  // Members
  members: {
    list: () => request<any[]>('/members'),
    get: (id: string) => request<any>(`/members/${id}`),
    create: (data: any) =>
      request<any>('/members', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request<any>(`/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/members/${id}`, {
        method: 'DELETE',
      }),
    getBalance: (id: string) => request<{ balance: number }>(`/members/${id}/balance`),
  },

  // Attendance
  attendance: {
    list: (params?: { date?: string; member_id?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.date) q.append('date', params.date);
      if (params?.member_id) q.append('member_id', params.member_id);
      if (params?.from) q.append('from', params.from);
      if (params?.to) q.append('to', params.to);
      return request<any[]>(`/attendance?${q.toString()}`);
    },
    mark: (data: { member_id: string; date: string; present: boolean }) =>
      request<any>('/attendance', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    bulkMark: (data: { date: string; attendances: Array<{ member_id: string; present: boolean }> }) =>
      request<{ message: string }>('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/attendance/${id}`, {
        method: 'DELETE',
      }),
  },

  // Payments, Salaries & Bonuses
  payments: {
    list: (params?: { member_id?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.member_id) q.append('member_id', params.member_id);
      if (params?.from) q.append('from', params.from);
      if (params?.to) q.append('to', params.to);
      return request<any[]>(`/payments?${q.toString()}`);
    },
    create: (data: { member_id: string; amount: number; note?: string; paid_at?: string }) =>
      request<any>('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/payments/${id}`, {
        method: 'DELETE',
      }),

    // Bonuses
    listBonuses: (params?: { member_id?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.member_id) q.append('member_id', params.member_id);
      if (params?.from) q.append('from', params.from);
      if (params?.to) q.append('to', params.to);
      return request<any[]>(`/payments/bonuses?${q.toString()}`);
    },
    createBonus: (data: { member_id: string; amount: number; reason?: string; given_at?: string }) =>
      request<any>('/payments/bonuses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteBonus: (id: string) =>
      request<{ message: string }>(`/payments/bonuses/${id}`, {
        method: 'DELETE',
      }),

    // Monthly Salaries
    listSalaries: (params?: { member_id?: string; month?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.member_id) q.append('member_id', params.member_id);
      if (params?.month) q.append('month', params.month);
      if (params?.from) q.append('from', params.from);
      if (params?.to) q.append('to', params.to);
      return request<any[]>(`/payments/salaries?${q.toString()}`);
    },
    saveSalary: (data: { member_id: string; month: string; amount: number }) =>
      request<any>('/payments/salaries', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Shootings & Expenses
  shootings: {
    list: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.from) q.append('from', params.from);
      if (params?.to) q.append('to', params.to);
      return request<any[]>(`/shootings?${q.toString()}`);
    },
    create: (data: any) =>
      request<any>('/shootings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request<any>(`/shootings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/shootings/${id}`, {
        method: 'DELETE',
      }),
    getSummary: (id: string) =>
      request<{
        present_count: number;
        attendance_cost: number;
        extra_cost: number;
        total_cost: number;
      }>(`/shootings/${id}/summary`),
    listExpenses: (id: string) => request<any[]>(`/shootings/${id}/expenses`),
    addExpense: (id: string, data: { amount: number; note?: string; spent_at?: string }) =>
      request<any>(`/shootings/${id}/expenses`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteExpense: (id: string, expenseId: string) =>
      request<{ message: string }>(`/shootings/${id}/expenses/${expenseId}`, {
        method: 'DELETE',
      }),
  },

  // Clients & Channels
  clients: {
    listChannels: () => request<any[]>('/clients/channels'),
    createChannel: (data: { name: string; is_own?: boolean }) =>
      request<any>('/clients/channels', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteChannel: (id: string) =>
      request<{ message: string }>(`/clients/channels/${id}`, {
        method: 'DELETE',
      }),

    listDirectors: () => request<any[]>('/clients/directors'),
    createDirector: (data: { name: string; phone?: string }) =>
      request<any>('/clients/directors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteDirector: (id: string) =>
      request<{ message: string }>(`/clients/directors/${id}`, {
        method: 'DELETE',
      }),

    listPayments: (params?: { channel?: string; shooting_id?: string }) => {
      const q = new URLSearchParams();
      if (params?.channel) q.append('channel', params.channel);
      if (params?.shooting_id) q.append('shooting_id', params.shooting_id);
      return request<any[]>(`/clients/payments?${q.toString()}`);
    },
    createPayment: (data: any) =>
      request<any>('/clients/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deletePayment: (id: string) =>
      request<{ message: string }>(`/clients/payments/${id}`, {
        method: 'DELETE',
      }),

    getChannelSummary: () => request<any[]>('/clients/channel-summary'),
  },

  // Reports
  reports: {
    getSummary: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.from) q.append('from', params.from);
      if (params?.to) q.append('to', params.to);
      return request<any>(`/reports/summary?${q.toString()}`);
    },
  },

  // Upload
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ url: string; filename: string; size: number }>('/upload', {
      method: 'POST',
      body: formData,
    });
  },
};
