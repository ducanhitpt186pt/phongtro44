const need = (k) => { const v = process.env[k]; if (!v) throw Object.assign(new Error(`Thiếu biến môi trường ${k}`), { status: 500, code: 'CONFIG' }); return v; };
export const cfg = {
  get password() { return process.env.APP_PASSWORD || ''; },
  get passwordHash() { return process.env.APP_PASSWORD_HASH || ''; },
  get sessionSecret() { const s = need('SESSION_SECRET'); if (s.length < 24) throw Object.assign(new Error('SESSION_SECRET phải dài ít nhất 24 ký tự'), { status: 500, code: 'CONFIG' }); return s; },
  get ghToken() { return need('GITHUB_TOKEN'); },
  get ghOwner() { return need('GITHUB_OWNER'); },
  get ghRepo() { return need('GITHUB_REPO'); },
  get ghBranch() { return process.env.GITHUB_BRANCH || 'main'; },
  get dbPath() { return process.env.GITHUB_DB_PATH || 'database.json'; },
};
