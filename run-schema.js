// Run this script to create the DemandScope tables in Supabase
// Usage: node run-schema.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running DemandScope schema migration...');
  console.log('Supabase URL:', supabaseUrl);

  const schemaPath = path.join(__dirname, 'supabase-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split by semicolons and run each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to run\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { sql: stmt });

    if (error) {
      // Try direct query for DDL statements
      const { error: queryError } = await supabase.from('_').select().limit(0);

      // Most DDL won't work via JS client, so we'll just note it
      if (stmt.includes('CREATE TABLE') || stmt.includes('CREATE INDEX') || stmt.includes('CREATE POLICY')) {
        console.log('  -> Run this statement directly in Supabase SQL Editor');
      } else {
        console.log('  -> Note: May need to run in SQL Editor');
      }
    } else {
      console.log('  -> OK');
    }
  }

  console.log('\n===========================================');
  console.log('IMPORTANT: Copy the contents of supabase-schema.sql');
  console.log('and run it in your Supabase SQL Editor at:');
  console.log(`${supabaseUrl.replace('.supabase.co', '')}/project/default/sql`);
  console.log('===========================================\n');
}

runMigration().catch(console.error);
