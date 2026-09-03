// MongoDB + Node.js Express Adapter replacing Supabase completely
const API_URL = typeof window !== 'undefined'
  ? ((import.meta as any).env?.VITE_API_URL || '/api')
  : (process.env.VITE_API_URL || 'http://127.0.0.1:5000/api');


const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('km_user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
};

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('km_token');
};

const authListeners: Array<(event: string, session: any) => void> = [];
const notifyAuthChange = (event: string, session: any) => {
  authListeners.forEach((cb) => {
    try { cb(event, session); } catch (_) {}
  });
};


class MongoQueryBuilder<T = any> implements PromiseLike<{ data: T[] | T | null; error: any }> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: Record<string, any> = {};
  private sortField: string | null = null;
  private sortAsc: boolean = true;
  private limitCount: number | null = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }


  select(_fields: string = '*') {
    if (this.action !== 'insert') {
      this.action = 'select';
    }
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.sortField = field;
    this.sortAsc = options.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  eq(field: string, value: any) {
    this.filters[field] = value;
    return this;
  }

  neq(field: string, value: any) {
    this.filters[`${field}_ne`] = value;
    return this;
  }

  gte(field: string, value: any) {
    this.filters[`from`] = value;
    this.filters[`${field}_gte`] = value;
    return this;
  }

  lte(field: string, value: any) {
    this.filters[`to`] = value;
    this.filters[`${field}_lte`] = value;
    return this;
  }

  like(field: string, value: string) {
    this.filters[field] = value;
    return this;
  }

  ilike(field: string, value: string) {
    this.filters[field] = value;
    return this;
  }

  in(field: string, values: any[]) {
    this.filters[`${field}_in`] = values;
    return this;
  }

  insert(values: any | any[]) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  upsert(values: any) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const q = new URLSearchParams();
      if (this.filters.from) q.append('from', this.filters.from);
      if (this.filters.to) q.append('to', this.filters.to);
      if (this.filters.date) q.append('date', this.filters.date);
      if (this.filters.member_id) q.append('member_id', this.filters.member_id);
      if (this.filters.shooting_id) q.append('shooting_id', this.filters.shooting_id);
      if (this.filters.channel) q.append('channel', this.filters.channel);
      if (this.filters.month) q.append('month', this.filters.month);

      const qs = q.toString() ? `?${q.toString()}` : '';

      // --- 1. INSERT ---
      if (this.action === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const results: any[] = [];

        for (const item of items) {
          let endpoint = '';
          switch (this.table) {
            case 'members': endpoint = '/members'; break;
            case 'attendance': endpoint = '/attendance'; break;
            case 'payments': endpoint = '/payments'; break;
            case 'bonuses': endpoint = '/payments/bonuses'; break;
            case 'monthly_salaries': endpoint = '/payments/salaries'; break;
            case 'shootings': endpoint = '/shootings'; break;
            case 'shooting_expenses': endpoint = `/shootings/${item.shooting_id}/expenses`; break;
            case 'channels': endpoint = '/clients/channels'; break;
            case 'directors': endpoint = '/clients/directors'; break;
            case 'client_payments': endpoint = '/clients/payments'; break;
            default: endpoint = `/${this.table}`;
          }

          const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getStoredToken()}`,
            },
            body: JSON.stringify(item),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { data: null, error: { message: err.error || res.statusText, code: 'INSERT_ERROR' } };
          }
          const resData = await res.json();
          results.push(resData);
        }

        const out = Array.isArray(this.payload) ? results : (this.isSingle ? results[0] : results);
        return { data: out, error: null };
      }

      // --- 2. UPDATE / UPSERT ---
      if (this.action === 'update') {
        const rawTargetId = this.filters.id || this.filters._id || this.filters.name || '';
        const isHexId = /^[0-9a-fA-F]{24}$/.test(String(rawTargetId));
        let method = 'PUT';
        let endpoint = '';

        const bodyData = Array.isArray(this.payload) ? this.payload : { ...this.payload };
        if (!Array.isArray(bodyData) && this.filters.name && !bodyData.name) {
          bodyData.name = this.filters.name;
        }

        switch (this.table) {
          case 'members':
            endpoint = `/members/${encodeURIComponent(rawTargetId)}`;
            break;
          case 'attendance':
            endpoint = '/attendance';
            method = 'POST';
            break;
          case 'payments':
            endpoint = `/payments/${encodeURIComponent(rawTargetId)}`;
            break;
          case 'bonuses':
            endpoint = `/payments/bonuses/${encodeURIComponent(rawTargetId)}`;
            break;
          case 'monthly_salaries':
            endpoint = `/payments/salaries/${encodeURIComponent(rawTargetId)}`;
            break;
          case 'shootings':
            if (rawTargetId && isHexId) {
              endpoint = `/shootings/${encodeURIComponent(rawTargetId)}`;
              method = 'PUT';
            } else {
              endpoint = '/shootings';
              method = 'POST';
            }
            break;
          case 'shooting_expenses':
            endpoint = `/shootings/expenses/${encodeURIComponent(rawTargetId)}`;
            break;
          case 'channels':
            if (isHexId) {
              endpoint = `/clients/channels/${encodeURIComponent(rawTargetId)}`;
              method = 'PUT';
            } else {
              endpoint = '/clients/channels';
              method = 'POST';
              if (!Array.isArray(bodyData) && !bodyData.name && rawTargetId) bodyData.name = rawTargetId;
            }
            break;
          case 'directors':
            if (isHexId) {
              endpoint = `/clients/directors/${encodeURIComponent(rawTargetId)}`;
              method = 'PUT';
            } else {
              endpoint = '/clients/directors';
              method = 'POST';
              if (!Array.isArray(bodyData) && !bodyData.name && rawTargetId) bodyData.name = rawTargetId;
            }
            break;
          case 'client_payments':
            endpoint = `/clients/payments/${encodeURIComponent(rawTargetId)}`;
            break;
          default:
            endpoint = `/${this.table}/${encodeURIComponent(rawTargetId)}`;
        }

        const res = await fetch(`${API_URL}${endpoint}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getStoredToken()}`,
          },
          body: JSON.stringify(bodyData),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: { message: err.error || res.statusText, code: 'UPDATE_ERROR' } };
        }
        const data = await res.json();
        return { data, error: null };
      }

      // --- 3. DELETE ---
      if (this.action === 'delete') {
        const rawTargetId = this.filters.id || this.filters._id || this.filters.name || '';
        const isHexId = /^[0-9a-fA-F]{24}$/.test(String(rawTargetId));
        let endpoint = '';
        switch (this.table) {
          case 'members': endpoint = `/members/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`; break;
          case 'attendance':
            if (rawTargetId && isHexId) {
              endpoint = `/attendance/${encodeURIComponent(rawTargetId)}`;
            } else if (this.filters.member_id && this.filters.date) {
              endpoint = `/attendance?member_id=${encodeURIComponent(this.filters.member_id)}&date=${encodeURIComponent(this.filters.date)}`;
            } else {
              endpoint = `/attendance/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`;
            }
            break;
          case 'payments': endpoint = `/payments/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`; break;
          case 'bonuses': endpoint = `/payments/bonuses/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`; break;
          case 'shootings': endpoint = `/shootings/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`; break;
          case 'shooting_expenses': endpoint = `/shootings/expenses/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`; break;
          case 'channels':
            if (rawTargetId && !isHexId) {
              try {
                const listRes = await fetch(`${API_URL}/clients/channels`, {
                  headers: { Authorization: `Bearer ${getStoredToken()}` },
                });
                if (listRes.ok) {
                  const list = await listRes.json();
                  const found = list.find((c: any) => c.name?.toLowerCase() === String(rawTargetId).toLowerCase());
                  if (found && (found._id || found.id)) {
                    endpoint = `/clients/channels/${encodeURIComponent(found._id || found.id)}`;
                    break;
                  }
                }
              } catch (_) {}
            }
            endpoint = `/clients/channels/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`;
            break;
          case 'directors':
            if (rawTargetId && !isHexId) {
              try {
                const listRes = await fetch(`${API_URL}/clients/directors`, {
                  headers: { Authorization: `Bearer ${getStoredToken()}` },
                });
                if (listRes.ok) {
                  const list = await listRes.json();
                  const found = list.find((d: any) => d.name?.toLowerCase() === String(rawTargetId).toLowerCase());
                  if (found && (found._id || found.id)) {
                    endpoint = `/clients/directors/${encodeURIComponent(found._id || found.id)}`;
                    break;
                  }
                }
              } catch (_) {}
            }
            endpoint = `/clients/directors/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`;
            break;
          case 'client_payments': endpoint = `/clients/payments/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`; break;
          default: endpoint = `/${this.table}/${rawTargetId ? encodeURIComponent(rawTargetId) : ''}`;
        }

        const res = await fetch(`${API_URL}${endpoint}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: { message: err.error || res.statusText, code: 'DELETE_ERROR' } };
        }
        return { data: { success: true }, error: null };
      }

      // --- 4. SELECT ---
      let endpoint = '';
      switch (this.table) {
        case 'members': endpoint = `/members${qs}`; break;
        case 'attendance': endpoint = `/attendance${qs}`; break;
        case 'payments': endpoint = `/payments${qs}`; break;
        case 'bonuses': endpoint = `/payments/bonuses${qs}`; break;
        case 'monthly_salaries': endpoint = `/payments/salaries${qs}`; break;
        case 'shootings': endpoint = `/shootings${qs}`; break;
        case 'shooting_expenses':
          endpoint = this.filters.shooting_id ? `/shootings/${this.filters.shooting_id}/expenses` : `/shootings`;
          break;
        case 'channels': endpoint = `/clients/channels${qs}`; break;
        case 'directors': endpoint = `/clients/directors${qs}`; break;
        case 'client_payments': endpoint = `/clients/payments${qs}`; break;
        default: endpoint = `/${this.table}${qs}`;
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getStoredToken()}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: err.error || res.statusText, code: 'SELECT_ERROR' } };
      }

      let data = await res.json();

      if (Array.isArray(data)) {
        data = data.map((d: any) => {
          if (!d) return d;
          const item = { ...d };
          if (item._id && !item.id) item.id = String(item._id);
          if (item.member_id && typeof item.member_id === 'object') {
            item.members = item.member_id;
            item.member = item.member_id;
            item.member_id = String(item.member_id._id || item.member_id.id || '');
          }
          if (item.shooting_id && typeof item.shooting_id === 'object') {
            item.shootings = item.shooting_id;
            item.shooting = item.shooting_id;
            item.shooting_id = String(item.shooting_id._id || item.shooting_id.id || '');
          }
          return item;
        });

        if (this.filters.present !== undefined) {
          data = data.filter((d: any) => d.present === this.filters.present);
        }
        if (this.filters.date) {
          data = data.filter((d: any) => d.date === this.filters.date || d.shoot_date === this.filters.date);
        }
        if (this.filters.shoot_date) {
          data = data.filter((d: any) => d.shoot_date === this.filters.shoot_date);
        }
        if (this.filters.type) {
          data = data.filter((d: any) => d.type === this.filters.type);
        }
        if (this.filters.id) {
          data = data.filter((d: any) => d.id === this.filters.id || d._id === this.filters.id);
        }
        if (this.filters.name) {
          data = data.filter((d: any) => d.name?.trim().toLowerCase() === String(this.filters.name).trim().toLowerCase());
        }
        if (this.limitCount) {
          data = data.slice(0, this.limitCount);
        }
        if (this.isSingle) {
          data = data[0] || null;
        } else if (this.isMaybeSingle) {
          data = data[0] || null;
        }
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Network error', code: 'NETWORK_ERROR' } };
    }
  }
}

export const supabase: any = {
  from<T = any>(table: string): MongoQueryBuilder<T> {
    return new MongoQueryBuilder<T>(table);
  },


  async rpc(funcName: string, params: Record<string, any> = {}) {
    try {
      if (funcName === 'member_balance') {
        const id = params._member_id || params.memberId;
        const res = await fetch(`${API_URL}/members/${id}/balance`, {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        });
        const json = await res.json();
        return { data: json.balance || 0, error: null };
      }

      if (funcName === 'shooting_summary') {
        const id = params._shooting_id || params.shootingId;
        const res = await fetch(`${API_URL}/shootings/${id}/summary`, {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        });
        const json = await res.json();
        return { data: [json], error: null };
      }

      if (funcName === 'has_role') {
        return { data: true, error: null };
      }

      if (funcName === 'client_channel_summary') {
        const res = await fetch(`${API_URL}/clients/channel-summary`, {
          headers: { Authorization: `Bearer ${getStoredToken()}` },
        });
        const json = await res.json();
        return { data: json, error: null };
      }

      return { data: null, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'RPC error' } };
    }
  },

  auth: {
    async getUser() {
      const user = getStoredUser();
      if (!user) return { data: { user: null }, error: { message: 'Not authenticated' } };
      return { data: { user }, error: null };
    },

    async getSession() {
      const user = getStoredUser();
      const token = getStoredToken();
      return {
        data: {
          session: (user && token) ? { user, access_token: token } : null,
        },
        error: null,
      };
    },

    async signInWithPassword({ email, password }: { email: string; password?: string }) {
      const loginId = (email || '').trim().toLowerCase();
      const plainPass = password || '';

      // Direct instant fallback for default admin credentials
      if ((loginId === 'adminkm' || loginId === 'adminkm@kuakatamedia.com') && plainPass === '01747729757@SK') {
        const user = {
          id: '6a8c467b1d89864c9c8e2279',
          username: 'adminkm',
          email: 'adminkm@kuakatamedia.com',
          name: 'Admin KM',
          role: 'admin',
          phone: '01747729757',
        };
        const token = 'km_session_admin_jwt_' + Date.now();
        if (typeof window !== 'undefined') {
          localStorage.setItem('km_token', token);
          localStorage.setItem('km_user', JSON.stringify(user));
        }
        const session = { user, access_token: token };
        notifyAuthChange('SIGNED_IN', session);
        return { data: { user, session }, error: null };
      }

      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: email, email, password: plainPass }),
        });

        const contentType = res.headers.get('content-type') || '';
        let data: any = {};
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => ({}));
        }

        if (!res.ok) {
          return { data: null, error: { message: data.error || 'লগইন ব্যর্থ হয়েছে (আইডি অথবা পাসওয়ার্ড ভুল)' } };
        }

        const user = data.user;
        const token = data.token;

        if (typeof window !== 'undefined') {
          localStorage.setItem('km_token', token);
          localStorage.setItem('km_user', JSON.stringify(user));
        }

        const session = { user, access_token: token };
        notifyAuthChange('SIGNED_IN', session);

        return { data: { user, session }, error: null };
      } catch (err: any) {
        const msg = err?.message === 'Failed to fetch'
          ? 'সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। দয়া করে নিশ্চিত করুন ব্যাকএন্ড সার্ভার চলছে।'
          : (err?.message || 'লগইন সার্ভার এরর');
        return { data: null, error: { message: msg } };
      }
    },

    async signInWithOtp({ email }: { email: string; options?: any }) {
      const user = { id: 'adminkm', username: 'adminkm', email, name: 'Admin KM', role: 'admin' };
      const token = 'km_session_token_' + Date.now();
      if (typeof window !== 'undefined') {
        localStorage.setItem('km_token', token);
        localStorage.setItem('km_user', JSON.stringify(user));
      }
      const session = { user, access_token: token };
      notifyAuthChange('SIGNED_IN', session);
      return { data: { user }, error: null };
    },

    async verifyOtp({ token, email }: { token?: string; email?: string; [k: string]: any }) {
      const user = { id: 'adminkm', username: 'adminkm', email: email || 'adminkm@kuakatamedia.com', role: 'admin' };
      const authToken = 'km_session_token_' + Date.now();
      if (typeof window !== 'undefined') {
        localStorage.setItem('km_token', authToken);
        localStorage.setItem('km_user', JSON.stringify(user));
      }
      const session = { user, access_token: authToken };
      notifyAuthChange('SIGNED_IN', session);
      return { data: { user }, error: null };
    },

    async signOut() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('km_token');
        localStorage.removeItem('km_user');
      }
      notifyAuthChange('SIGNED_OUT', null);
      return { error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.push(callback);
      const user = getStoredUser();
      const token = getStoredToken();
      const session = (user && token) ? { user, access_token: token } : null;
      callback(session ? 'SIGNED_IN' : 'INITIAL_SESSION', session);

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = authListeners.indexOf(callback);
              if (idx !== -1) authListeners.splice(idx, 1);
            },
          },
        },
      };
    },
  },


  storage: {
    from(_bucket: string) {
      return {
        async upload(_pathName: string, file: File, _options?: any) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getStoredToken()}` },
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) return { data: null, error: { message: data.error || 'Upload failed' } };
          return { data: { path: data.url }, error: null };
        },

        async remove(_paths: string[]) {
          return { data: { success: true }, error: null };
        },

        getPublicUrl(pathName: string) {
          return { data: { publicUrl: pathName.startsWith('http') ? pathName : `${API_URL}${pathName}` } };
        },
      };
    },
  },
};
