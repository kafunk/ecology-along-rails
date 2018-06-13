select id from (select distinct on (st_asbinary(geom)) id from (
select * from north_america_physical.watersheds_us_mex_can_attr
order by name,naw4_en,wscssdanam,toponimo,sub_hid) t
order by st_asbinary(geom)) as a
where id is not null


create table north_america_watersheds_final as

 select * from
(select * from (select pk_id as id, id_j as id_orig, ROW_NUMBER() OVER (PARTITION BY st_asbinary(geom)
                           ORDER BY name,naw4_en,wscssdanam,toponimo,sub_hid) AS id_j2
from north_america_physical.watersheds_us_mex_can_attr) A
where id_j2 = 1 and id_orig is not null) B
left join north_america_physical.watersheds_us_mex_can_attr C
on B.id = C.pk_id


SELECT DISTINCT ON (ST_AsBinary(geom)) geom FROM
(select id,geom,wscssda,wscssdanam,can_sda,wscsda,can_sda_en,wscsdaname,can_mda,wscmda,can_mda_en,wscmdaname,ocean
from north_america_physical.watersheds_us_mex_can_attr
where can_sda != wscsda) t
order by (st_asbinary(geom))

;;;

create table north_america_physical.watersheds_102008_final as
select id, geom, datasetnam as drain_code, wscssdanam as drain_name, wscsdaname as drain_name2, wscmdaname as drain_name3, usa_reg_na as drain_name4, naw1_en as drain_name5, provcd_1 as region, provcd_2 as reg_overlaps, country, alt_max, alt_min, oid
from north_america_watersheds_final
order by drain_code;

;;;
update north_america_physical.watersheds_102008_final as a
set drain_code = huc8
from north_america_watersheds_final as b
where drain_code is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final
set country = 'MEX'
where drain_code is null;

update north_america_physical.watersheds_102008_final
set country = 'CAN'
where country is null;

update north_america_physical.watersheds_102008_final as a
set drain_code = codigo
from north_america_watersheds_final as b
where drain_code is null and
a.id=b.id;
;;;;

update north_america_physical.watersheds_102008_final as a
set drain_name = name
from north_america_watersheds_final as b
where drain_name is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name = toponimo
from north_america_watersheds_final as b
where drain_name is null and
a.id=b.id;

;;

update north_america_physical.watersheds_102008_final as a
set drain_name2 = usa_acc_na
from north_america_watersheds_final as b
where drain_name2 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name2 = sub_hid
from north_america_watersheds_final as b
where drain_name2 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name2 = can_sda_en
from north_america_watersheds_final as b
where drain_name2 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name2 = naw4_en
from north_america_watersheds_final as b
where drain_name2 is null and
a.id=b.id;
;;;

update north_america_physical.watersheds_102008_final as a
set drain_name3 = usa_sub_na
from north_america_watersheds_final as b
where drain_name3 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name3 = reg_hid
from north_america_watersheds_final as b
where drain_name3 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name3 = can_mda_en
from north_america_watersheds_final as b
where drain_name3 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name3 = naw3_en
from north_america_watersheds_final as b
where drain_name3 is null and
a.country != 'CAN' and
a.id=b.id;
;;;

update north_america_physical.watersheds_102008_final as a
set drain_name4 = usa_reg_na
from north_america_watersheds_final as b
where drain_name4 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name4 = edo_cuen
from north_america_watersheds_final as b
where drain_name4 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name4 = naw3_en
from north_america_watersheds_final as b
where drain_name4 is null and
country = 'CAN' and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name4 = naw2_en
from north_america_watersheds_final as b
where drain_name4 is null and
a.id=b.id;

;;;

update north_america_physical.watersheds_102008_final as a
set drain_name5 = naw1_en
from north_america_watersheds_final as b
where drain_name5 is null and
a.id=b.id;

update north_america_physical.watersheds_102008_final as a
set drain_name5 = ocean
from north_america_watersheds_final as b
where drain_name5 is null and
a.id=b.id;

;;


update north_america_physical.watersheds_102008_final as a
set region = null
where region='';

update north_america_physical.watersheds_102008_final as a
set overlaps = null
where overlaps='';

//
update north_america_physical.watersheds_102008_final
set drain_code=null
where drain_code='';
update north_america_physical.watersheds_102008_final
set drain_name=null
where drain_name='';
update north_america_physical.watersheds_102008_final
set drain_name2=null
where drain_name2='';
update north_america_physical.watersheds_102008_final
set drain_name3=null
where drain_name3='';
update north_america_physical.watersheds_102008_final
set drain_name4=null
where drain_name4='';
update north_america_physical.watersheds_102008_final
set drain_name5=null
where drain_name5='';
update north_america_physical.watersheds_102008_final
set region=null
where region='';
update north_america_physical.watersheds_102008_final
set reg_overlaps=null
where reg_overlaps='';
update north_america_physical.watersheds_102008_final
set country=null
where country='';
update north_america_physical.watersheds_102008_final
set alt_max = null
where alt_max='';
update north_america_physical.watersheds_102008_final
set alt_min = null
where alt_min='';

//



update north_america_physical.watersheds_102008_final
set provcd_1=null
where provcd_1='';
update north_america_physical.watersheds_102008_final
set provcd_2=null
where provcd_2='';
update north_america_physical.watersheds_102008_final
set provcd_3=null
where provcd_3='';
update north_america_physical.watersheds_102008_final
set provcd_4=null
where provcd_4='';

update north_america_physical.watersheds_102008_final
set ocean=null
where ocean='';
update north_america_physical.watersheds_102008_final
set datasetnam=null
where datasetnam='';

update north_america_physical.watersheds_102008_final
set wscmdaname=null
where wscmdaname='';
update north_america_physical.watersheds_102008_final
set wscsdaname=null
where wscsdaname='';
update north_america_physical.watersheds_102008_final
set wscssdanam=null
where wscssdanam='';

update north_america_physical.watersheds_102008_final
set usa_reg_na=null
where usa_reg_na='';
update north_america_physical.watersheds_102008_final
set usa_sub_na=null
where usa_sub_na='';
update north_america_physical.watersheds_102008_final
set usa_acc_na=null
where usa_acc_na='';
