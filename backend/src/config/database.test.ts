import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { pool, testConnection, closePool } from './database.js';

describe('Database Connection and Schema Tests', () => {
  let testPool: Pool;
  let client: PoolClient;

  beforeAll(async () => {
    // Use the existing pool for tests
    testPool = pool;
  });

  afterAll(async () => {
    // Close all connections after tests
    if (client) {
      client.release();
    }
    await closePool();
  });

  describe('Database Connection Pooling', () => {
    it('should create a valid connection pool with correct configuration', () => {
      expect(pool).toBeDefined();
      expect(pool).toBeInstanceOf(Pool);
      
      // Verify pool configuration
      expect(pool.options.min).toBe(parseInt(process.env.DB_POOL_MIN || '2', 10));
      expect(pool.options.max).toBe(parseInt(process.env.DB_POOL_MAX || '10', 10));
      expect(pool.options.idleTimeoutMillis).toBe(30000);
      expect(pool.options.connectionTimeoutMillis).toBe(2000);
    });

    it('should successfully connect to the database', async () => {
      const result = await testConnection();
      expect(result).toBe(true);
    });

    it('should acquire a client from the pool', async () => {
      client = await testPool.connect();
      expect(client).toBeDefined();
      
      // Verify the client can execute queries
      const result = await client.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
      
      client.release();
    });

    it('should handle multiple concurrent connections within pool limits', async () => {
      const clients: PoolClient[] = [];
      const maxConnections = parseInt(process.env.DB_POOL_MAX || '10', 10);
      
      try {
        // Acquire multiple clients (but stay within pool limits)
        for (let i = 0; i < Math.min(3, maxConnections); i++) {
          const c = await testPool.connect();
          clients.push(c);
        }
        
        expect(clients.length).toBeGreaterThan(0);
        
        // Verify all clients can execute queries
        const results = await Promise.all(
          clients.map((c, i) => c.query('SELECT $1 as num', [i]))
        );
        
        results.forEach((result, i) => {
          expect(result.rows[0].num).toBe(i);
        });
      } finally {
        // Release all clients
        clients.forEach(c => c.release());
      }
    });

    it('should handle connection timeout gracefully', async () => {
      // Create a pool with very short timeout for testing
      const shortTimeoutPool = new Pool({
        ...pool.options,
        connectionTimeoutMillis: 100,
        host: 'invalid-host-that-does-not-exist.local',
      });

      await expect(async () => {
        await shortTimeoutPool.connect();
      }).rejects.toThrow();

      await shortTimeoutPool.end();
    });

    it('should reuse idle connections from the pool', async () => {
      // Acquire and release a client
      const client1 = await testPool.connect();
      const clientId1 = (client1 as any).processID;
      client1.release();
      
      // Acquire another client - should potentially reuse the same connection
      const client2 = await testPool.connect();
      const clientId2 = (client2 as any).processID;
      client2.release();
      
      // At minimum, both clients should be valid
      expect(clientId1).toBeDefined();
      expect(clientId2).toBeDefined();
    });
  });

  describe('Schema Creation and Validation', () => {
    beforeEach(async () => {
      // Connect for schema tests
      client = await testPool.connect();
    });

    it('should verify test_items table exists with correct structure', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'test_items'
        ORDER BY ordinal_position
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      // Verify essential columns exist
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('item_id');
      expect(columns).toContain('section');
      expect(columns).toContain('type');
      expect(columns).toContain('difficulty_level');
      expect(columns).toContain('stage');
      expect(columns).toContain('content');
      expect(columns).toContain('options');
      expect(columns).toContain('correct_answer');
      expect(columns).toContain('irt_parameters');
      expect(columns).toContain('metadata');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should verify exam_sessions table exists with correct structure', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'exam_sessions'
        ORDER BY ordinal_position
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      // Verify essential columns exist
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('start_time');
      expect(columns).toContain('end_time');
      expect(columns).toContain('expiration_time');
      expect(columns).toContain('current_section');
      expect(columns).toContain('current_module');
      expect(columns).toContain('current_question');
      expect(columns).toContain('answers');
      expect(columns).toContain('ability_estimates');
      expect(columns).toContain('status');
    });

    it('should verify cefr_conversion table exists with correct structure', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'cefr_conversion'
        ORDER BY ordinal_position
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      // Verify essential columns exist
      const columns = result.rows.map(row => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('section');
      expect(columns).toContain('theta_min');
      expect(columns).toContain('theta_max');
      expect(columns).toContain('cefr_band');
      expect(columns).toContain('scale_score');
    });

    it('should verify JSONB columns are correctly typed', async () => {
      const result = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'test_items'
        AND data_type = 'jsonb'
      `);

      const jsonbColumns = result.rows.map(row => row.column_name);
      expect(jsonbColumns).toContain('options');
      expect(jsonbColumns).toContain('irt_parameters');
      expect(jsonbColumns).toContain('metadata');
    });

    it('should verify CHECK constraints on test_items table', async () => {
      const result = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
        AND constraint_name LIKE '%test_items%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      // Check constraints should include section and difficulty_level
      const constraints = result.rows.map(row => row.check_clause);
      const hasConstraints = constraints.some(clause => 
        clause && (clause.includes('section') || clause.includes('difficulty_level') || clause.includes('stage'))
      );
      expect(hasConstraints).toBe(true);
    });

    it('should verify CHECK constraints on exam_sessions table', async () => {
      const result = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
        AND constraint_name LIKE '%exam_sessions%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      // Check constraint should include status
      const constraints = result.rows.map(row => row.check_clause);
      const hasStatusConstraint = constraints.some(clause => 
        clause && clause.includes('status')
      );
      expect(hasStatusConstraint).toBe(true);
    });

    it('should verify UUID extension is enabled', async () => {
      const result = await client.query(`
        SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].extname).toBe('uuid-ossp');
    });

    it('should verify triggers are created for updated_at columns', async () => {
      const result = await client.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_name LIKE '%updated_at%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const tables = result.rows.map(row => row.event_object_table);
      expect(tables).toContain('test_items');
      expect(tables).toContain('exam_sessions');
    });
  });

  describe('Index Creation and Validation', () => {
    beforeEach(async () => {
      client = await testPool.connect();
    });

    it('should verify indexes on test_items table exist', async () => {
      const result = await client.query(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE tablename = 'test_items'
        AND schemaname = 'public'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const indexes = result.rows.map(row => row.indexname);
      expect(indexes).toContain('idx_test_items_section');
      expect(indexes).toContain('idx_test_items_difficulty');
      expect(indexes).toContain('idx_test_items_stage');
      expect(indexes).toContain('idx_test_items_type');
    });

    it('should verify indexes on exam_sessions table exist', async () => {
      const result = await client.query(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE tablename = 'exam_sessions'
        AND schemaname = 'public'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const indexes = result.rows.map(row => row.indexname);
      expect(indexes).toContain('idx_exam_sessions_session_id');
      expect(indexes).toContain('idx_exam_sessions_user_id');
      expect(indexes).toContain('idx_exam_sessions_status');
    });

    it('should verify indexes on cefr_conversion table exist', async () => {
      const result = await client.query(`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE tablename = 'cefr_conversion'
        AND schemaname = 'public'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
      
      const indexes = result.rows.map(row => row.indexname);
      expect(indexes).toContain('idx_cefr_conversion_section');
    });

    it('should verify primary key indexes exist', async () => {
      const result = await client.query(`
        SELECT conname, conrelid::regclass AS table_name, contype
        FROM pg_constraint
        WHERE contype = 'p'
        AND connamespace = 'public'::regnamespace
        AND conrelid::regclass::text IN ('test_items', 'exam_sessions', 'cefr_conversion')
      `);

      expect(result.rows.length).toBe(3);
      
      const tables = result.rows.map(row => row.table_name);
      expect(tables).toContain('test_items');
      expect(tables).toContain('exam_sessions');
      expect(tables).toContain('cefr_conversion');
    });

    it('should verify unique constraint on test_items.item_id', async () => {
      const result = await client.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'test_items'::regclass
        AND contype = 'u'
      `);

      const uniqueConstraints = result.rows.map(row => row.conname);
      const hasItemIdConstraint = uniqueConstraints.some(name => 
        name.includes('item_id')
      );
      expect(hasItemIdConstraint).toBe(true);
    });

    it('should verify unique constraint on exam_sessions.session_id', async () => {
      const result = await client.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'exam_sessions'::regclass
        AND contype = 'u'
      `);

      const uniqueConstraints = result.rows.map(row => row.conname);
      const hasSessionIdConstraint = uniqueConstraints.some(name => 
        name.includes('session_id')
      );
      expect(hasSessionIdConstraint).toBe(true);
    });
  });

  describe('Schema Rollback and Data Integrity', () => {
    it('should handle transaction rollback correctly', async () => {
      const client = await testPool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Insert test data
        await client.query(`
          INSERT INTO test_items (
            item_id, section, type, difficulty_level, stage, content, 
            irt_parameters, correct_answer
          ) VALUES (
            'test-rollback-item', 'reading', 'multiple-choice', 'medium', 1, 
            'Test content', '{"a": 1.0, "b": 0.0, "c": 0.2}', 'A'
          )
        `);
        
        // Verify insert
        const checkResult = await client.query(`
          SELECT * FROM test_items WHERE item_id = 'test-rollback-item'
        `);
        expect(checkResult.rows.length).toBe(1);
        
        // Rollback transaction
        await client.query('ROLLBACK');
        
        // Verify data was rolled back
        const verifyResult = await client.query(`
          SELECT * FROM test_items WHERE item_id = 'test-rollback-item'
        `);
        expect(verifyResult.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('should handle transaction commit correctly', async () => {
      const client = await testPool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Insert test data
        await client.query(`
          INSERT INTO test_items (
            item_id, section, type, difficulty_level, stage, content, 
            irt_parameters, correct_answer
          ) VALUES (
            'test-commit-item', 'reading', 'multiple-choice', 'medium', 1, 
            'Test content', '{"a": 1.0, "b": 0.0, "c": 0.2}', 'A'
          )
        `);
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Verify data was committed
        const verifyResult = await client.query(`
          SELECT * FROM test_items WHERE item_id = 'test-commit-item'
        `);
        expect(verifyResult.rows.length).toBe(1);
        expect(verifyResult.rows[0].item_id).toBe('test-commit-item');
        
        // Cleanup
        await client.query(`
          DELETE FROM test_items WHERE item_id = 'test-commit-item'
        `);
      } finally {
        client.release();
      }
    });

    it('should verify CEFR conversion data is seeded', async () => {
      const client = await testPool.connect();
      
      try {
        const result = await client.query(`
          SELECT DISTINCT section FROM cefr_conversion ORDER BY section
        `);
        
        expect(result.rows.length).toBe(4);
        const sections = result.rows.map(row => row.section);
        expect(sections).toEqual(['listening', 'reading', 'speaking', 'writing']);
        
        // Verify each section has 6 CEFR bands
        for (const section of sections) {
          const bandResult = await client.query(`
            SELECT COUNT(*) as count FROM cefr_conversion WHERE section = $1
          `, [section]);
          expect(parseInt(bandResult.rows[0].count)).toBe(6);
        }
      } finally {
        client.release();
      }
    });
  });

  describe('Database Connection Error Handling', () => {
    it('should handle query errors gracefully', async () => {
      const client = await testPool.connect();
      
      try {
        await expect(async () => {
          await client.query('SELECT * FROM non_existent_table');
        }).rejects.toThrow();
      } finally {
        client.release();
      }
    });

    it('should handle invalid SQL gracefully', async () => {
      const client = await testPool.connect();
      
      try {
        await expect(async () => {
          await client.query('INVALID SQL STATEMENT');
        }).rejects.toThrow();
      } finally {
        client.release();
      }
    });

    it('should handle connection release properly', async () => {
      const client = await testPool.connect();
      const result = await client.query('SELECT 1');
      expect(result.rows[0]['?column?']).toBe(1);
      
      // Release should not throw
      expect(() => client.release()).not.toThrow();
    });
  });
});
