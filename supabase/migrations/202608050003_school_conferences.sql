with conference_map(school_name, conference) as (values
    ('U.S. Air Force Academy', 'MPSF'),
    ('University of California, San Diego', 'MPSF'),
    ('University of the Incarnate Word', 'MPSF'),
    ('Boston College', 'ACC'),
    ('University of Notre Dame', 'ACC'),
    ('Stanford University', 'ACC'),
    ('University of North Carolina, Chapel Hill', 'ACC'),
    ('Duke University', 'ACC'),
    ('The Ohio State University', 'CCFC'),
    ('Northwestern University', 'CCFC'),
    ('University of Detroit Mercy', 'CCFC'),
    ('Wayne State University (Michigan)', 'CCFC'),
    ('Lawrence University', 'CCFC'),
    ('Denison University', 'CCFC'),
    ('Cleveland State University', 'CCFC'),
    ('Brown University', 'Ivy League'),
    ('Columbia University-Barnard College', 'Ivy League'),
    ('Cornell University', 'Ivy League'),
    ('Harvard University', 'Ivy League'),
    ('Princeton University', 'Ivy League'),
    ('University of Pennsylvania', 'Ivy League'),
    ('Yale University', 'Ivy League'),
    ('Fairleigh Dickinson University, Metropolitan Campus', 'Independent'),
    ('Long Island University', 'Independent'),
    ('New York University', 'Independent'),
    ('Penn State', 'Independent'),
    ('Pennsylvania State University', 'Independent'),
    ('St. John''s University (New York)', 'Independent'),
    ('Temple University', 'Independent'),
    ('Wagner College', 'Independent'),
    ('The City College of New York', 'Independent'),
    ('Lafayette College', 'MACFA'),
    ('New Jersey Institute of Technology', 'MACFA'),
    ('Drew University', 'MACFA'),
    ('Haverford College', 'MACFA'),
    ('Hunter College', 'MACFA'),
    ('Johns Hopkins University', 'MACFA'),
    ('Stevens Institute of Technology', 'MACFA'),
    ('Yeshiva University', 'MACFA'),
    ('Brandeis University', 'NFC'),
    ('Sacred Heart University', 'NFC'),
    ('Massachusetts Institute of Technology', 'NFC'),
    ('Tufts University', 'NFC'),
    ('Vassar College', 'NFC'),
    ('Wellesley College', 'NFC'),
    ('Wheaton College (Massachusetts)', 'NFC')
)
update public.schools s
set conference = conference_map.conference
from conference_map
where s.name = conference_map.school_name;

update public.program_seasons ps
set conference = s.conference
from public.programs p
join public.schools s on s.id = p.school_id
where ps.program_id = p.id;
