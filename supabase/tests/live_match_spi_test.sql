begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
create temporary table previous_spi as select * from public.spi_results;
select public.recalculate_season_spi((select id from public.seasons where slug='2024-25'));
select is((select count(*)::integer from public.spi_results r join previous_spi p using(id)
    join public.seasons s on s.id=r.season_id where s.slug='2024-25' and abs(r.spi-p.spi)>0.000000001),
    0, 'Database formula matches all 324 historical TypeScript results');
select is((select count(*)::integer from public.spi_results r join previous_spi p using(id)
    join public.seasons s on s.id=r.season_id where s.slug<>'2024-25' and r.spi<>p.spi),
    0, 'Recalculation leaves every other season unchanged');
create temporary table selected_match as select m.* from public.matches m join public.seasons s on s.id=m.season_id
    where s.slug='2024-25' and m.left_epee<>m.right_epee limit 1;
update public.matches set left_epee=right_epee, right_epee=left_epee where id=(select id from selected_match);
select ok(exists(select 1 from public.spi_results r join previous_spi p using(id) where r.spi<>p.spi),
    'Editing a match automatically changes SPI');
update public.matches m set left_epee=x.left_epee,right_epee=x.right_epee from selected_match x where m.id=x.id;
select is((select count(*)::integer from public.spi_results r join previous_spi p using(id)
    where abs(r.spi-p.spi)>0.000000001),0,'Restoring the scores restores the original SPI');
delete from public.matches where id=(select id from selected_match);
select ok(exists(select 1 from public.spi_results r join previous_spi p using(id) where abs(r.spi-p.spi)>0.000000001),
    'Deleting a match automatically changes SPI');
insert into public.matches select * from selected_match;
select is((select count(*)::integer from public.spi_results r join previous_spi p using(id)
    where abs(r.spi-p.spi)>0.000000001),0,'Inserting a match restores SPI');
select throws_ok($$update public.matches set fenced_on='1900-01-01' where id=(select id from selected_match)$$,
    'P0001','Competition date is outside the selected season.','Wrong-season dates are rejected');
select ok(not has_function_privilege('anon','public.recalculate_season_spi(uuid)','execute'),
    'Anonymous users cannot invoke the privileged calculation');
select * from finish();
rollback;
