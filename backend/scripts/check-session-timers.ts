import { pool } from '../src/config/database.js';

async function checkSessionTimers() {
  try {
    const query = await pool.query(
      `SELECT 
        session_id,
        start_time,
        expiration_time,
        status,
        EXTRACT(EPOCH FROM (expiration_time - start_time))/60 as duration_minutes,
        EXTRACT(EPOCH FROM (expiration_time - NOW()))/60 as remaining_minutes
      FROM exam_sessions
      ORDER BY created_at DESC
      LIMIT 5`
    );

    console.log('📊 Recent Sessions and Their Timers:');
    console.log('═══════════════════════════════════════\n');

    query.rows.forEach(row => {
      console.log(`Session ID: ${row.session_id}`);
      console.log(`Status: ${row.status}`);
      console.log(`Start Time: ${row.start_time}`);
      console.log(`Expiration Time: ${row.expiration_time}`);
      console.log(`Duration: ${Math.round(row.duration_minutes)} minutes`);
      console.log(`Remaining: ${Math.round(row.remaining_minutes)} minutes`);
      console.log('---');
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkSessionTimers();
