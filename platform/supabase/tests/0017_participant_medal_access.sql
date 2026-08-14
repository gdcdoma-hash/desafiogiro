begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

select has_table('public', 'participant_user_links', 'participant account link table exists');
select has_function('public', 'current_participant_id', array[]::text[], 'current participant resolver exists');
select has_function('public', 'my_medal_deliveries', array[]::text[], 'participant medal delivery query exists');
select has_function('public', 'confirm_my_medal_delivery_receipt', array['uuid','text'], 'participant receipt confirmation exists');
select has_function('public', 'report_my_medal_delivery_issue', array['uuid','text'], 'participant issue report exists');

select * from finish();
rollback;
