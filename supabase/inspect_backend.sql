-- READ-ONLY BACKEND INVENTORY
-- Run in the Supabase SQL Editor before reviewing clean_backend.sql.
-- This file does not create, update, or delete anything.

-- Application tables and columns.
select
  columns.table_name,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from information_schema.columns columns
where columns.table_schema = 'public'
order by columns.table_name, columns.ordinal_position;

-- Primary keys, unique constraints, checks, and foreign keys.
select
  relation.relname as table_name,
  constraint_record.conname as constraint_name,
  constraint_record.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(constraint_record.oid, true) as definition
from pg_catalog.pg_constraint constraint_record
join pg_catalog.pg_class relation
  on relation.oid = constraint_record.conrelid
join pg_catalog.pg_namespace namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
order by relation.relname, constraint_record.conname;

-- User-created triggers, including the Auth profile trigger.
select
  trigger_namespace.nspname as table_schema,
  table_record.relname as table_name,
  trigger_record.tgname as trigger_name,
  function_namespace.nspname as function_schema,
  function_record.proname as function_name,
  pg_catalog.pg_get_triggerdef(trigger_record.oid, true) as definition
from pg_catalog.pg_trigger trigger_record
join pg_catalog.pg_class table_record
  on table_record.oid = trigger_record.tgrelid
join pg_catalog.pg_namespace trigger_namespace
  on trigger_namespace.oid = table_record.relnamespace
join pg_catalog.pg_proc function_record
  on function_record.oid = trigger_record.tgfoid
join pg_catalog.pg_namespace function_namespace
  on function_namespace.oid = function_record.pronamespace
where not trigger_record.tgisinternal
  and trigger_namespace.nspname in ('auth', 'public')
order by trigger_namespace.nspname, table_record.relname, trigger_record.tgname;

-- Existing public functions and their complete definitions.
select
  function_record.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(function_record.oid) as arguments,
  pg_catalog.pg_get_functiondef(function_record.oid) as definition
from pg_catalog.pg_proc function_record
join pg_catalog.pg_namespace namespace
  on namespace.oid = function_record.pronamespace
where namespace.nspname = 'public'
order by function_record.proname,
  pg_catalog.pg_get_function_identity_arguments(function_record.oid);

-- RLS state and policies.
select
  tables.tablename,
  tables.rowsecurity as rls_enabled,
  tables.forcerowsecurity as rls_forced
from pg_catalog.pg_tables tables
where tables.schemaname = 'public'
order by tables.tablename;

select
  policies.tablename,
  policies.policyname,
  policies.permissive,
  policies.roles,
  policies.cmd,
  policies.qual,
  policies.with_check
from pg_catalog.pg_policies policies
where policies.schemaname = 'public'
order by policies.tablename, policies.policyname;

-- Approximate row counts, including Auth users, without reading private rows.
select
  statistics.schemaname,
  statistics.relname as table_name,
  statistics.n_live_tup as approximate_rows
from pg_catalog.pg_stat_user_tables statistics
where statistics.schemaname in ('auth', 'public')
order by statistics.schemaname, statistics.relname;
