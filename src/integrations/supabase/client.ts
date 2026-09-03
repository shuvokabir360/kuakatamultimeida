// Direct MongoDB Atlas Sync + Resilient Offline-First Client Data Layer

const syncToMongo = async (payload: any) => {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => null);
  } catch (err) {
    console.warn('Direct MongoDB Atlas edge sync notice:', err);
    return null;
  }
};

const SEED_DATA: Record<string, any[]> = {
  members: [
    { id: "km_shuvo", _id: "km_shuvo", name: "Kabir Hossen Shuvo", role: "CEO", type: "monthly", rate: 0, phone: "01713953527" },
    { id: "km_badal", _id: "km_badal", name: "Badal", role: "Production", type: "daily", rate: 0, phone: "" },
    { id: "km_noyon", _id: "km_noyon", name: "Noyon Moni", role: "Production", type: "daily", rate: 0, phone: "" },
    { id: "km_jafor", _id: "km_jafor", name: "Jafor Howlader", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_milon", _id: "km_milon", name: "Abu Hasan Milon", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_sojib", _id: "km_sojib", name: "Sojib", role: "Production", type: "daily", rate: 0, phone: "" },
    { id: "km_bayzid", _id: "km_bayzid", name: "Bayzid", role: "Production", type: "daily", rate: 0, phone: "" },
    { id: "km_toha", _id: "km_toha", name: "Toha", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_tamanna", _id: "km_tamanna", name: "Tamanna", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_rimi", _id: "km_rimi", name: "Rimi", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_jisan", _id: "km_jisan", name: "Jisan Musulli", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_emon", _id: "km_emon", name: "Emon Molla", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_siraj", _id: "km_siraj", name: "Siraj Musulli", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_ziaur", _id: "km_ziaur", name: "Ziaur Rahman", role: "Editor & Cameraman", type: "monthly", rate: 0, phone: "" },
    { id: "km_porosh", _id: "km_porosh", name: "Porosh Moni", role: "Editor & Cameraman", type: "monthly", rate: 0, phone: "01610400509" },
    { id: "km_arif", _id: "km_arif", name: "Arif Apon", role: "Actor", type: "daily", rate: 0, phone: "" },
    { id: "km_sagar", _id: "km_sagar", name: "Masud Pervez Sagar", role: "Actor", type: "daily", rate: 3500, phone: "01746772754" },
    { id: "km_almas", _id: "km_almas", name: "SM Almas", role: "Actor & Director", type: "daily", rate: 0, phone: "" },
    { id: "km_abir", _id: "km_abir", name: "Abubakar Abir", role: "Ass. Director", type: "monthly", rate: 0, phone: "01713953527" },
  ],
  channels: [
    { id: "6a8c4d15ad70648be9d4147b", _id: "6a8c4d15ad70648be9d4147b", name: "Kuakata Multimedia" },
    { id: "6a9663d061442a29257ba029", _id: "6a9663d061442a29257ba029", name: "Malbro Entertainment" },
    { id: "6a9663e161442a29257ba033", _id: "6a9663e161442a29257ba033", name: "Projapoti Multimedia" },
    { id: "6a9663ed61442a29257ba03d", _id: "6a9663ed61442a29257ba03d", name: "Mehedi Multimedia" }
  ],
  directors: [
    { id: "6a8c4db9ad70648be9d414cc", _id: "6a8c4db9ad70648be9d414cc", name: "Saddam Mal", phone: "" },
    { id: "6a964f4e61442a29257b3160", _id: "6a964f4e61442a29257b3160", name: "SM ALMAS", phone: "" }
  ],
  attendance: [],
  payments: [],
  bonuses: [],
  monthly_salaries: [],
  shootings: [],
  shooting_expenses: [],
  client_payments: [],
};

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

const getLocalTable = (table: string): any[] => {
  if (typeof window === 'undefined') return SEED_DATA[table] || [];
  try {
    const raw = localStorage.getItem(`km_tbl_${table}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}

  const seed = SEED_DATA[table] || [];
  if (seed.length > 0) {
    try {
      localStorage.setItem(`km_tbl_${table}`, JSON.stringify(seed));
    } catch (_) {}
  }
  return [...seed];
};

const setLocalTable = (table: string, items: any[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`km_tbl_${table}`, JSON.stringify(items));
  } catch (_) {}
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
    // --- 1. INSERT ---
    if (this.action === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const localList = getLocalTable(this.table);
      const insertedItems: any[] = [];

      for (const item of items) {
        const fullItem = {
          id: item.id || item._id || ('km_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8)),
          _id: item._id || item.id || ('km_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8)),
          createdAt: item.createdAt || new Date().toISOString(),
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };

        localList.unshift(fullItem);
        insertedItems.push(fullItem);
      }

      setLocalTable(this.table, localList);

      // Direct edge sync to MongoDB Atlas
      syncToMongo({
        action: 'insert',
        table: this.table,
        data: insertedItems,
      });

      const out = Array.isArray(this.payload) ? insertedItems : (this.isSingle ? insertedItems[0] : insertedItems);
      return { data: out, error: null };
    }

    // --- 2. UPDATE / UPSERT ---
    if (this.action === 'update') {
      const rawTargetId = this.filters.id || this.filters._id || this.filters.name || '';
      const localList = getLocalTable(this.table);
      let updatedItem: any = null;

      const updatedList = localList.map((item) => {
        const matches = (rawTargetId && (item.id === rawTargetId || item._id === rawTargetId || item.name === rawTargetId))
          || (this.filters.member_id && item.member_id === this.filters.member_id && (!this.filters.date || item.date === this.filters.date));
        if (matches) {
          updatedItem = { ...item, ...this.payload, updatedAt: new Date().toISOString() };
          return updatedItem;
        }
        return item;
      });

      if (!updatedItem && rawTargetId) {
        updatedItem = { id: rawTargetId, _id: rawTargetId, ...this.payload, createdAt: new Date().toISOString() };
        updatedList.unshift(updatedItem);
      }

      setLocalTable(this.table, updatedList);

      // Direct edge sync to MongoDB Atlas
      syncToMongo({
        action: 'update',
        table: this.table,
        data: this.payload,
        filters: this.filters,
      });

      return { data: updatedItem || this.payload, error: null };
    }

    // --- 3. DELETE ---
    if (this.action === 'delete') {
      const rawTargetId = this.filters.id || this.filters._id || this.filters.name || '';
      const localList = getLocalTable(this.table);

      const filteredList = localList.filter((item) => {
        if (rawTargetId && (item.id === rawTargetId || item._id === rawTargetId || item.name === rawTargetId)) return false;
        if (this.filters.member_id && item.member_id === this.filters.member_id && this.filters.date && item.date === this.filters.date) return false;
        return true;
      });

      setLocalTable(this.table, filteredList);

      // Direct edge sync to MongoDB Atlas
      syncToMongo({
        action: 'delete',
        table: this.table,
        filters: this.filters,
      });

      return { data: { success: true }, error: null };
    }

    // --- 4. SELECT ---
    let data = [...getLocalTable(this.table)];

    if (Array.isArray(data)) {
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
      if (this.filters.member_id) {
        data = data.filter((d: any) => String(d.member_id || '') === String(this.filters.member_id));
      }
      if (this.limitCount) {
        data = data.slice(0, this.limitCount);
      }
      if (this.isSingle) {
        return { data: data[0] || null, error: null };
      } else if (this.isMaybeSingle) {
        return { data: data[0] || null, error: null };
      }
    }

    return { data, error: null };
  }
}

export const supabase: any = {
  from<T = any>(table: string): MongoQueryBuilder<T> {
    return new MongoQueryBuilder<T>(table);
  },

  async rpc(funcName: string, params: Record<string, any> = {}) {
    if (funcName === 'has_role') return { data: true, error: null };
    if (funcName === 'member_balance') return { data: 0, error: null };
    return { data: null, error: null };
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

      return { data: null, error: { message: 'লগইন ব্যর্থ হয়েছে (আইডি অথবা পাসওয়ার্ড ভুল)' } };
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
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve({ data: { path: dataUrl }, error: null });
            };
            reader.onerror = () => {
              resolve({ data: null, error: { message: 'Image read failed' } });
            };
            reader.readAsDataURL(file);
          });
        },

        async remove(_paths: string[]) {
          return { data: null, error: null };
        },

        getPublicUrl(pathName: string) {
          return { data: { publicUrl: pathName } };
        },
      };
    },
  },

  channel(_name: string) {
    return {
      on(_type: string, _opts: any, _cb: Function) {
        return this;
      },
      subscribe() {
        return this;
      },
      unsubscribe() {},
    };
  },
};
