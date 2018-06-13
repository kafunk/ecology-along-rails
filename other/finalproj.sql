create table north_america_physical.ecoregions2 as 
(select 1 as id, id as oid,geom, concat(na_l3code,'.',right(us_l4code,1)) as l4_key, us_l4name as l4_name, us_l3name as l3_name, na_l2name as l2_name, na_l1name as l1_name 
from north_america_physical.us_ecoregion_l4
order by l4_key)
union
(select 2 as id,id as oid,geom,
cveecon4 as l4_key,
desecon4 as l4_name, 
desecon4 as l3_name, 
desecon2 as l2_name, 
desecon1 as l1_name 
from north_america_physical.ca_mx_ecodistricts
where ecodistric is null
order by l4_key)
union 
(select 3 as id, id as oid,geom, concat(ecoprovince_id::varchar,ecoregion_id::varchar,ecodistrict_id::varchar) as l4_key,
ecodistrict_id::varchar as l4_name, 
ecoregion_id::varchar as l3_name, 
ecoprovince_id::varchar as l2_name, 
ecozone_id::varchar as l1_name 
from north_america_physical.can_ecodistrict
order by l4_key)
order by id,l4_key


create table trains.nodes_to_save as 
select * from trains.na_rail_nodes_all
where franodeid IN (SELECT frfranode FROM trains.na_pass_rail_routes_simp) or
franodeid IN (SELECT tofranode FROM trains.na_pass_rail_routes_simp)



alter table north_america_physical.ecoregions
alter column geom type geometry(Multipolygon,4326)


create table north_america_physical.can_ecoregions as 
select id,geom,concat(LPAD(ecoprovince_id::varchar,4,'0'),'.',LPAD(ecoregion_id::varchar,3,'0'),'.',LPAD(ecodistrict_id::varchar,4,'0')) as l4_key,
concat(LPAD(ecoprovince_id::varchar,4,'0'),'.',LPAD(ecoregion_id::varchar,3,'0'),'.',LPAD(ecodistrict_id::varchar,4,'0')) as l4_name,
concat(LPAD(ecoprovince_id::varchar,4,'0'),'.',LPAD(ecoregion_id::varchar,3,'0')) as l3_name,
LPAD(ecoprovince_id::varchar,4,'0') as l2_name,
LPAD(ecozone_id::varchar,2,'0') as l1_name
from north_america_physical.can_ecodistrict
order by l4_key

update north_america_physical.can_ecoregions
set l4_name = b."class title"
from north_america_physical.can_eco_names as b
where l4_name = b.code
and b."hierarchical structure" ILIKE '%ecodistrict%'
//etc






create table north_america_physical.ecoregions4extract_distinct as
select 1 as pk_id, * from (select distinct on (st_asbinary(geom)) geom as geom_d, * from 
(select * from north_america_physical.eco4_extract
order by l4_key,l4_name,l3_name,l2_name,l1_name) as a
order by st_asbinary(geom)) as b
order by l4_key,l4_name,l3_name,l2_name,l1_name



create table eco_rails.na_ecoreg_iv_extract_2 as 
select * from (select 1 as id, geom, concat(lpad(na_l3code,6,'0'),'.',lpad(us_l4code,3,'0')) as l4_key, us_l4name as l4_name,us_l3name as l3_name, null as l2_name,null as l1_name,'USA' as country, id as orig_oid from eco_rails.cleanypmap where geom is not null order by l4_key) a
union 
select * from (select 1 as id, geom, concat(lpad(l4_key,6,'0'),'.','0xx') as l4_key, null as l4_name, l3_name, l2_name,l1_name,'USA' as country, objectid as orig_oid from eco_rails.keep__ak order by l4_key) b
union
select * from (select 1 as id, geom, l4_key, l4_name, l3_name, l2_name,l1_name,'USA' as country, oid as orig_oid from eco_rails.difference_us4 order by l4_key) c
union
select * from (select * from (select 2 as id, geom, concat(lpad(l2_name,4,'0'),'.',lpad(l3_name,3,'0'),'.',lpad(right(l4_key,3),4,'0')) as l4_key,l4_name,l3_name,l2_name,l1_name,country,oid as orig_oid from eco_rails.can_clean_partial_extract
	where country = 'CAN' and length(l4_key) < 11 or id = 9200
	order by l4_key) a
	union
	select * from (select 2 as id, geom, concat(lpad(l2_name,4,'0'),'.',lpad(l3_name,3,'0'),'.',right(l4_key,4)) as l4_key,l4_name,l3_name,l2_name,l1_name,country,oid as orig_oid from eco_rails.can_clean_partial_extract
	where country = 'CAN' and length(l4_key) > 10
	order by l4_key) b
	union
	select * from (select 2 as id, geom, l4_key,l4_name,l3_name,l2_name,l1_name,country,oid as orig_oid from eco_rails.can_clean_partial_extract
	where (country is null or country = 'can') and id !=9200
	order by l4_key) c) d
union
select * from (select 3 as id,geom, lpad(cveecon4,8,'0') as l4_key,desecon4 as l4_name,desecon3 as l3_name,desecon2 as l2_name,desecon1 as l1_name,'MEX' as country,orig_ogc_fid as orig_oid from eco_rails.mexf order by l4_key) e
order by id,l4_key,l4_name


update eco_rails.na_ecoreg_iv_extract_finaler
set l3_name = l3_name_join
from (select l4_key as l4_key_join, id as id_join,l4_name as l4_name_join,l3_name as l3_name_join,l2_name as l2_name_join,l1_name as l1_name_join, id as orig_oid_join from north_america_physical.can_ecoregions) as b
where country = 'CAN' and l4_key = b.l4_key_join and l3_name ~ '^[0-9]' and l3_name ~ '[0-9]$'

update eco_rails.na_ecoreg_iv_extract_finaler
set l2_name = b.name_l2
from north_america_physical.terrestrial_ecoregions_4326 as b
where l2_name is null and orig_oid = b.objectid and l3_name ~* b.name

update eco_rails.na_ecoreg_iv_extract_finaler
set l2_name = b.name_l2
from north_america_physical.terrestrial_ecoregions_4326 as b
where orig_oid = objectid and 
l1_name = b.name_l1


update eco_rails.na_ecoreg_iv_extract_finaler
set country = 'CAN' from (select l4_key as l4_key_j, l1_name as l1_name_j from north_america_physical.can_ecoregions) as b where
l4_key = b.l4_key_j and
l1_name = b.l1_name_j

update eco_rails.na_ecoreg_iv_extract_finaler
set l1_name = b.name_l1
from north_america_physical.terrestrial_ecoregions_4326 as b
where l1_name is null and orig_oid = b.objectid and l3_name ~* b.name

update eco_rails.na_ecoreg_iv_extract_finaler
set l2_name = b.name_l2
from north_america_physical.terrestrial_ecoregions_4326 as b
where orig_oid = objectid and 
l3_name = b.l3_name

update eco_rails.na_ecoreg_iv_extract_finaler
set l4_key = '5.2.1.50z',
country = 'USA',
orig_oid = '31293132'
where country is null and l4_name = 'Rudyard Clay Plain'

update eco_rails.na_ecoreg_iv_extract_finaler
set l3_name = 'Algonquin--Lake Nipissing',
l2_name = 'Southern Boreal Shield',
l1_name = 'Boreal Shield',
country = 'CAN',
orig_oid = '642'
where l4_name = 'Thessalon' and country is null

update eco_rails.na_ecoreg_iv_extract_finaler
set l4_name = b.l4_name_j
from (select id as id_j, l4_key as l4_key_j, l4_name as l4_name_j, l3_name as l3_name_j from north_america_physical.can_ecoregions) as b
where l4_key = '08.1.132.0546'

update eco_rails.na_ecoreg_iv_extract_finaler
set l4_name = b.l4_name_j,
l3_name = b.l3_name_j
from (select id as id_j, l4_key as l4_key_j, l4_name as l4_name_j, l3_name as l3_name_j from north_america_physical.can_ecoregions) as b
where l4_key =  '10.3.214.1018'

update eco_rails.na_ecoreg_iv_extract_finaler
set l3_name = b.l3_name_join
from (select l4_key as l4_key_join, l3_name as l3_name_join from north_america_physical.can_ecoregions) as b
where l3_name is null and l4_key = b.l4_key_join

update eco_rails.na_ecoreg_iv_extract_finaler
set orig_oid = b.orig_oid_join
from (select l4_key as l4_key_join, orig_oid as orig_oid_join from north_america_physical.can_ecoregions) as b
where orig_oid is null and l4_key = b.l4_key_join

update eco_rails.na_ecoreg_iv_extract_finaler
set orig_oid = b.id_j from (select id as id_j, l4_key as l4_key_j, l4_name as l4_name_j, l3_name as l3_name_j from north_america_physical.can_ecoregions) as b
where l4_key = b.l4_key_j and orig_oid = 2

update eco_rails.na_ecoreg_iv_extract_finaler
set orig_oid = b.id_j from (select id as id_j, na_l3code from north_america_physical.us_ecoregion_l4) as b
where left(l4_key,6) = b.na_l3code and orig_oid = 1
