begin;

select plan(4);

select ok(
  not has_function_privilege('anon', 'public.my_giro(date)', 'EXECUTE'),
  'anon cannot execute my_giro'
);

select ok(
  has_function_privilege('authenticated', 'public.my_giro(date)', 'EXECUTE'),
  'authenticated can execute my_giro'
);

select ok(
  not has_function_privilege('anon', 'public.record_manual_activity(uuid,text,numeric,timestamp without time zone,text,text)', 'EXECUTE'),
  'anon cannot execute record_manual_activity'
);

select ok(
  has_function_privilege('authenticated', 'public.record_manual_activity(uuid,text,numeric,timestamp without time zone,text,text)', 'EXECUTE'),
  'authenticated can execute record_manual_activity'
);

select * from finish();
rollback;
