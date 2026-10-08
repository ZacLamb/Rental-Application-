const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 5,
});

// Creates the tables on first boot, so there is no separate setup step.
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at  timestamptz NOT NULL DEFAULT now(),
      status      text NOT NULL DEFAULT 'New',
      full_name   text NOT NULL,
      email       text NOT NULL,
      phone       text NOT NULL,
      data        jsonb NOT NULL,
      signed_ip   text,
      user_agent  text
    );
    CREATE TABLE IF NOT EXISTS application_files (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      filename        text NOT NULL,
      mimetype        text NOT NULL,
      size            integer NOT NULL,
      content         bytea NOT NULL
    );
    CREATE INDEX IF NOT EXISTS application_files_app_idx ON application_files(application_id);
  `);
}

async function createApplication({ data, ip, userAgent, files }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO applications (full_name, email, phone, data, signed_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.full_name, data.email, data.phone, JSON.stringify(data), ip, userAgent]
    );
    const id = rows[0].id;
    for (const f of files) {
      await client.query(
        `INSERT INTO application_files (application_id, filename, mimetype, size, content)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, f.filename, f.mimetype, f.size, f.buffer]
      );
    }
    await client.query('COMMIT');
    return id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listApplications() {
  const { rows } = await pool.query(
    `SELECT a.id, a.created_at, a.status, a.full_name, a.email, a.phone, a.data,
            (SELECT count(*)::int FROM application_files f WHERE f.application_id = a.id) AS file_count
     FROM applications a ORDER BY a.created_at DESC`
  );
  return rows;
}

async function getApplication(id) {
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const files = await pool.query(
    'SELECT id, filename, mimetype, size FROM application_files WHERE application_id = $1 ORDER BY filename',
    [id]
  );
  return { ...rows[0], files: files.rows };
}

async function listApplicationsWithFiles() {
  const { rows } = await pool.query('SELECT * FROM applications ORDER BY created_at DESC');
  const files = await pool.query(
    'SELECT id, application_id, filename, mimetype, size FROM application_files ORDER BY filename'
  );
  return rows.map((a) => ({ ...a, files: files.rows.filter((f) => f.application_id === a.id) }));
}

async function setStatus(id, status) {
  await pool.query('UPDATE applications SET status = $2 WHERE id = $1', [id, status]);
}

async function deleteApplication(id) {
  await pool.query('DELETE FROM applications WHERE id = $1', [id]);
}

async function getFile(id) {
  const { rows } = await pool.query('SELECT * FROM application_files WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { pool, init, createApplication, listApplications, listApplicationsWithFiles, getApplication, setStatus, deleteApplication, getFile };
