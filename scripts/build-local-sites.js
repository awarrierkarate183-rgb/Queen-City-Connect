'use strict';

const fs = require('fs');
const path = require('path');

function lib(name, address, phone) {
  return {
    name,
    category: 'Education',
    description: 'Charlotte Mecklenburg Library branch. Free Wi-Fi, homework help, teen programs, and volunteer roles (teen advisory, summer reading, events). Apply at cmlibrary.org/volunteer.',
    address,
    phone,
    website: 'https://www.cmlibrary.org/locations',
    hours: 'Hours vary — check cmlibrary.org',
    opportunities: ['help', 'volunteer']
  };
}

function rec(name, address, phone) {
  return {
    name,
    category: 'Youth',
    description: 'Mecklenburg County Park and Recreation center. Teen sports, camps, after-school programs, volunteer shifts, and seasonal jobs for students 16+.',
    address,
    phone: phone || '(980) 314-1000',
    website: 'https://parkandrec.mecknc.gov/Places-to-Visit/Rec-Centers',
    hours: 'Hours vary by center — check Park and Rec',
    opportunities: ['help', 'volunteer', 'intern']
  };
}

function ymca(name, address, phone) {
  return {
    name,
    category: 'Youth',
    description: 'YMCA of Greater Charlotte branch. Teen clubs, lifeguard training, camp counselor-in-training, volunteer, and youth employment (age rules apply).',
    address,
    phone,
    website: 'https://www.ymcacharlotte.org/locations',
    hours: 'Hours vary by branch',
    opportunities: ['volunteer', 'intern', 'help']
  };
}

const resources = [
  lib('CML – Allegra Westbrooks Regional', '2412 Beatties Ford Road, Charlotte, NC 28216', '(704) 416-3000'),
  lib('CML – Cornelius', '21105 Catawba Avenue, Cornelius, NC 28031', '(704) 416-3800'),
  lib('CML – Davidson', '119 South Main Street, Davidson, NC 28036', '(704) 416-4000'),
  lib('CML – Founders Hall', '100 N Tryon Street, Suite 290, Charlotte, NC 28202', '(704) 416-0100'),
  lib('CML – Hickory Grove', '5935 Hickory Grove Road, Charlotte, NC 28215', '(704) 416-4400'),
  lib('CML – Independence Regional', '6000 Conference Drive, Charlotte, NC 28212', '(704) 416-4800'),
  lib('CML – Matthews', '230 Matthews Station Street, Matthews, NC 28105', '(704) 416-5000'),
  lib('CML – Mint Hill', '6840 Matthews-Mint Hill Road, Mint Hill, NC 28227', '(704) 416-5200'),
  lib('CML – Mountain Island', '4420 Hoyt Galvin Way, Charlotte, NC 28214', '(704) 416-5600'),
  lib('CML – Myers Park', '1361 Queens Road, Charlotte, NC 28207', '(704) 416-5800'),
  lib('CML – North County Regional', '16500 Holly Crest Lane, Huntersville, NC 28078', '(704) 416-6000'),
  lib('CML – Pineville', '505 Main Street, Suite 100, Pineville, NC 28134', '(704) 416-3200'),
  lib('CML – Plaza Midwood', '1623 Central Avenue, Charlotte, NC 28205', '(704) 416-6200'),
  lib('CML – South Boulevard', '4429 South Boulevard, Charlotte, NC 28209', '(704) 416-6400'),
  lib('CML – South County Regional', '5801 Rea Road, Charlotte, NC 28277', '(704) 416-6600'),
  lib('CML – SouthPark Regional', '7015 Carnegie Boulevard, Charlotte, NC 28211', '(704) 416-5400'),
  lib('CML – Steele Creek', '13620 Steele Creek Road, Charlotte, NC 28273', '(704) 416-6800'),
  lib('CML – Sugar Creek', '4045 North Tryon Street, Suite A, Charlotte, NC 28206', '(704) 416-7000'),
  lib('CML – University City Regional', '301 East W.T. Harris Boulevard, Charlotte, NC 28262', '(704) 416-7200'),
  lib('CML – University City Waters Edge', '5528 Waters Edge Village Drive, Charlotte, NC 28262', '(704) 416-7200'),
  lib('CML – West Boulevard', '2157 West Boulevard, Charlotte, NC 28208', '(704) 416-7400'),
  rec('Albemarle Road Recreation Center', '5027 Idlewild Road North, Charlotte, NC 28227'),
  rec('Amay James Recreation Center', '2425 Lester Street, Charlotte, NC 28208'),
  rec('Arbor Glen Outreach Facility', '1520 Clanton Road, Charlotte, NC 28208', '(980) 314-1110'),
  rec('Berewick Recreation Center', '5910 Dixie River Road, Charlotte, NC 28278', '(980) 314-1102'),
  rec('Bette Rae Thomas Recreation Center', '2921 Tuckaseegee Road, Charlotte, NC 28208'),
  rec('Eastway Regional Recreation Center', '3150 Eastway Park Drive, Charlotte, NC 28213', '(980) 314-3772'),
  rec('Elon Recreation Center', '11401 Ardery Kell Road, Charlotte, NC 28277'),
  rec('Hickory Grove Recreation Center', '6709 Pence Road, Charlotte, NC 28215'),
  rec('Ivory Baker Recreation Center', '1920 Stroud Park Court, Charlotte, NC 28206'),
  rec('Mallard Creek Recreation Center', '2350 Johnston-Oehler Road, Charlotte, NC 28269', '(980) 314-1121'),
  rec('Marion Diehl Recreation Center', '2219 Tyvola Road, Charlotte, NC 28210'),
  rec('Mecklenburg County Aquatic Center', '800 E Martin Luther King Jr Blvd, Charlotte, NC 28202'),
  rec('Methodist Home Recreation Center', '3200 Shamrock Road, Charlotte, NC 28215'),
  rec('Naomi Drenan Recreation Center', '750 Beal Street, Charlotte, NC 28211'),
  rec('Northern Regional Recreation Center', '18121 Old Statesville Road, Cornelius, NC 28031'),
  rec('Ray\'s Splash Planet', '215 N Sycamore Street, Charlotte, NC 28202'),
  rec('Revolution Park Sports Academy', '1225 Remount Road, Charlotte, NC 28208'),
  rec('Southview Recreation Center', '1720 Vilma Street, Charlotte, NC 28208'),
  rec('Sugaw Creek Recreation Center', '943 W Sugar Creek Road, Charlotte, NC 28213'),
  rec('Tuckaseegee Recreation Center', '4820 Tuckaseegee Road, Charlotte, NC 28208'),
  rec('Tyvola Senior Center volunteer site', '2225 Tyvola Road, Charlotte, NC 28210'),
  rec('Wallace Pruitt Recreation Center', '501 S Bruns Avenue, Charlotte, NC 28208'),
  rec('West Charlotte Recreation Center', '2401 Kendall Drive, Charlotte, NC 28216'),
  rec('Winget Recreation Center', '12235 Winget Road, Charlotte, NC 28278'),
  rec('Renaissance Park / golf volunteer site', '1525 W Tyvola Road, Charlotte, NC 28210'),
  rec('Huntersville Family Fitness & Aquatics', '14008 Holbrooks Road, Huntersville, NC 28078'),
  rec('Ballantyne Recreation area programs', '11010 Beau Riley Road, Charlotte, NC 28277'),
  rec('MLK School Recreation Site', '500 Bilmark Avenue, Charlotte, NC 28213'),
  rec('First Ward Recreation / A.G. Gaston', '1501 Euclid Avenue, Charlotte, NC 28203'),
  rec('Pearl Street Park programs', '710 E Martin Luther King Jr Blvd, Charlotte, NC 28202'),
  ymca('Brace Family YMCA', '3127 Weddington Road, Matthews, NC 28105', '(704) 716-4200'),
  ymca('Childress Klein YMCA', '301 S College Street, Charlotte, NC 28202', '(704) 716-6400'),
  ymca('Dowd YMCA', '400 E Morehead Street, Charlotte, NC 28202', '(704) 716-6100'),
  ymca('Harris Express YMCA', '4625 Piedmont Row Drive, Charlotte, NC 28210', '(704) 716-6980'),
  ymca('Harris YMCA', '5900 Quail Hollow Road, Charlotte, NC 28210', '(704) 716-6800'),
  ymca('Johnston YMCA', '3025 N Davidson Street, Charlotte, NC 28205', '(704) 716-6300'),
  ymca('Keith Family YMCA', '8100 Old Mallard Creek Road, Charlotte, NC 28262', '(704) 716-6700'),
  ymca('Lake Norman YMCA', '21300 Davidson Street, Cornelius, NC 28031', '(704) 716-4400'),
  ymca('McCrorey YMCA', '3801 Beatties Ford Road, Charlotte, NC 28216', '(704) 716-6500'),
  ymca('Morrison Family YMCA', '9405 Bryant Farms Road, Charlotte, NC 28277', '(704) 716-4600'),
  ymca('Sara\'s YMCA', '15940 Brixham Hill Avenue, Charlotte, NC 28277', '(704) 716-4680'),
  ymca('Simmons YMCA', '6824 Democracy Drive, Charlotte, NC 28212', '(704) 716-6600'),
  ymca('Stratford Richardson YMCA', '1946 West Boulevard, Charlotte, NC 28208', '(704) 716-4800'),
  ymca('Hemby Program Center YMCA', '9760 Happy Valley Drive, Charlotte, NC 28270', '(704) 716-4200'),
  ymca('YMCA Steele Creek at Central Presbyterian', '9401 S Tryon Street, Charlotte, NC 28278', '(704) 716-4900'),
  {
    name: 'Reedy Creek Nature Center',
    category: 'Volunteer',
    description: 'County nature center with trails, exhibits, and volunteer naturalist/education roles. Strong fit for environmental science students.',
    address: '2900 Rocky River Road, Charlotte, NC 28215',
    phone: '(980) 314-1128',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'See nature center hours',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'McDowell Nature Center',
    category: 'Volunteer',
    description: 'Southwest Mecklenburg nature preserve. Volunteer with education programs, trails, and camps.',
    address: '15222 York Road, Charlotte, NC 28278',
    phone: '(980) 314-1128',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'See nature center hours',
    opportunities: ['volunteer']
  },
  {
    name: 'Latta Nature Center / Historic Latta Plantation',
    category: 'Volunteer',
    description: 'Nature center and historic farm on Mountain Island Lake. Volunteer with animals, trails, and education programs.',
    address: '6211 Sample Road, Huntersville, NC 28078',
    phone: '(704) 875-1391',
    website: 'https://www.lattaplantation.org',
    hours: 'See website',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Cowans Ford Wildlife Refuge volunteer days',
    category: 'Volunteer',
    description: 'Wildlife refuge volunteer workdays through Mecklenburg Park and Rec and partner groups. Trail and habitat help for students.',
    address: '1990 Neck Road, Huntersville, NC 28078',
    phone: '(980) 314-1000',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'Volunteer dates posted online',
    opportunities: ['volunteer']
  },
  {
    name: 'McAlpine Creek Greenway volunteer days',
    category: 'Volunteer',
    description: 'Greenway cleanups and trail days. Easy group service hours in south Charlotte.',
    address: '8711 Monroe Road, Charlotte, NC 28212',
    phone: '(980) 314-1000',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'Volunteer dates posted online',
    opportunities: ['volunteer']
  },
  {
    name: 'Freedom Park volunteer & events',
    category: 'Volunteer',
    description: 'Signature Charlotte park. Event volunteer, park cleanups, and nearby rec programs.',
    address: '1900 East Blvd, Charlotte, NC 28203',
    phone: '(980) 314-1000',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'Dawn to dusk; events posted online',
    opportunities: ['volunteer']
  },
  {
    name: 'Romare Bearden Park volunteer events',
    category: 'Volunteer',
    description: 'Uptown park events and cleanups. Downtown service hours with an easy bus/light-rail trip.',
    address: '300 S Church Street, Charlotte, NC 28202',
    phone: '(980) 314-1000',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'Dawn to dusk',
    opportunities: ['volunteer']
  },
  {
    name: 'Jetton Park (Lake Norman) volunteer',
    category: 'Volunteer',
    description: 'Waterfront park in Cornelius. Volunteer at events, lakefront cleanups, and seasonal programs.',
    address: '19000 Jetton Road, Cornelius, NC 28031',
    phone: '(980) 314-1000',
    website: 'https://parkandrec.mecknc.gov',
    hours: 'Park hours posted online',
    opportunities: ['volunteer']
  },
  {
    name: 'Discovery Place Kids – Huntersville',
    category: 'Volunteer',
    description: 'Children’s museum in Huntersville. Teen volunteer and camp helper roles; STEM-friendly resume hours.',
    address: '105 Gilead Road, Huntersville, NC 28078',
    phone: '(704) 372-6261',
    website: 'https://discoveryplace.org',
    hours: 'See website',
    opportunities: ['volunteer']
  },
  {
    name: 'Billy Graham Library volunteer',
    category: 'Volunteer',
    description: 'Museum and library volunteer roles for guest services and tours. Age minimums apply — check the volunteer page.',
    address: '4330 Westmont Drive, Charlotte, NC 28217',
    phone: '(704) 401-3200',
    website: 'https://billygrahamlibrary.org',
    hours: 'See volunteer page',
    opportunities: ['volunteer']
  },
  {
    name: 'Actor\'s Theatre of Charlotte',
    category: 'Volunteer',
    description: 'Local theater usher and production support. Good for students interested in performing arts.',
    address: '650 E Stonewall Street, Charlotte, NC 28202',
    phone: '(704) 342-2251',
    website: 'https://atcharlotte.org',
    hours: 'See show calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'Theatre Charlotte',
    category: 'Volunteer',
    description: 'Community theater in Myers Park. Usher, scene shop, and education volunteer roles.',
    address: '501 Queens Road, Charlotte, NC 28207',
    phone: '(704) 376-3777',
    website: 'https://theatrecharlotte.org',
    hours: 'See production calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte Symphony volunteer',
    category: 'Volunteer',
    description: 'Usher and education volunteer roles at Belk Theater and community concerts.',
    address: '130 N Tryon Street, Charlotte, NC 28202',
    phone: '(704) 972-2003',
    website: 'https://charlottesymphony.org',
    hours: 'See concert calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'Opera Carolina volunteer',
    category: 'Volunteer',
    description: 'Production and education volunteers for opera performances downtown.',
    address: '1600 Elizabeth Avenue, Charlotte, NC 28204',
    phone: '(704) 332-7177',
    website: 'https://operacarolina.org',
    hours: 'See season calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'McColl Center',
    category: 'Internships',
    description: 'Artist residency and contemporary art center. Watch for internships and event volunteer shifts.',
    address: '721 N Tryon Street, Charlotte, NC 28202',
    phone: '(704) 332-5535',
    website: 'https://mccollcenter.org',
    hours: 'See website',
    opportunities: ['intern', 'volunteer']
  },
  {
    name: 'Charlotte Speech and Hearing Center',
    category: 'Health',
    description: 'Speech, language, and hearing care. Volunteer and pre-health observation (age rules apply). Families can get services here.',
    address: '505 S Caldwell Street, Charlotte, NC 28202',
    phone: '(704) 523-8027',
    website: 'https://www.charlottespeechhearing.com',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Atrium Health Levine Children\'s volunteer',
    category: 'Volunteer',
    description: 'Children’s hospital volunteer program. Typically 16+ with application, orientation, and a time commitment. Strong for future nurses and doctors.',
    address: '1000 Blythe Blvd, Charlotte, NC 28203',
    phone: '(704) 381-2000',
    website: 'https://atriumhealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Atrium Health Mercy volunteer',
    category: 'Volunteer',
    description: 'Hospital volunteer roles in Elizabeth. Check teen age minimums before you apply.',
    address: '2001 Vail Avenue, Charlotte, NC 28207',
    phone: '(704) 304-5000',
    website: 'https://atriumhealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Atrium Health Pineville volunteer',
    category: 'Volunteer',
    description: 'South Charlotte hospital volunteer program. Age and shot requirements listed on the Atrium volunteer page.',
    address: '10628 Park Road, Charlotte, NC 28210',
    phone: '(704) 667-1000',
    website: 'https://atriumhealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Atrium Health University City volunteer',
    category: 'Volunteer',
    description: 'University area hospital volunteer roles. Apply through Atrium volunteer services.',
    address: '8800 N Tryon Street, Charlotte, NC 28262',
    phone: '(704) 863-6000',
    website: 'https://atriumhealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Novant Health Presbyterian Medical Center volunteer',
    category: 'Volunteer',
    description: 'Hospital volunteer at Presbyterian. Confirm teen eligibility on the Novant volunteer page.',
    address: '200 Hawthorne Lane, Charlotte, NC 28204',
    phone: '(704) 384-4000',
    website: 'https://www.novanthealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Novant Health Matthews Medical Center volunteer',
    category: 'Volunteer',
    description: 'Matthews hospital volunteer program. Age minimums apply.',
    address: '1500 Matthews Township Parkway, Matthews, NC 28105',
    phone: '(704) 384-6500',
    website: 'https://www.novanthealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Novant Health Huntersville Medical Center volunteer',
    category: 'Volunteer',
    description: 'North Mecklenburg hospital volunteer roles. Check the Novant volunteer application for ages.',
    address: '10030 Gilead Road, Huntersville, NC 28078',
    phone: '(704) 316-4000',
    website: 'https://www.novanthealth.org',
    hours: 'Application online',
    opportunities: ['volunteer']
  },
  {
    name: 'Care Ring dental & medical clinic',
    category: 'Health',
    description: 'Low-cost medical and dental clinic. Get care if you do not have a doctor, or ask about volunteer (age rules apply).',
    address: '4445 The Plaza, Charlotte, NC 28215',
    phone: '(704) 375-0172',
    website: 'https://careringnc.org',
    hours: 'By appointment',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Charlotte Community Health Clinic – Central',
    category: 'Health',
    description: 'Affordable clinic for people without insurance. Students can get care; older students can ask about volunteer.',
    address: '8401 Medical Plaza Drive, Suite 300, Charlotte, NC 28262',
    phone: '(704) 316-6561',
    website: 'https://charlottecommunityhealthclinic.org',
    hours: 'Mon–Fri clinic hours',
    opportunities: ['help']
  },
  {
    name: 'Mecklenburg County Health Department – Beatties Ford',
    category: 'Health',
    description: 'Immunizations, teen clinic services, and public health. Call for appointments.',
    address: '2845 Beatties Ford Road, Charlotte, NC 28216',
    phone: '(980) 314-9300',
    website: 'https://www.mecknc.gov/HealthDepartment',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help']
  },
  {
    name: 'Mecklenburg County Health Department – Valerie C. Woodard',
    category: 'Health',
    description: 'County public health campus: WIC, immunizations, and clinic services for families and teens.',
    address: '3205 Freedom Drive, Charlotte, NC 28208',
    phone: '(980) 314-9300',
    website: 'https://www.mecknc.gov/HealthDepartment',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help']
  },
  {
    name: 'NC MedAssist',
    category: 'Health',
    description: 'Free and low-cost prescription help for people who qualify. Statewide service with Charlotte presence.',
    address: '4428 Taggart Creek Road, Charlotte, NC 28208',
    phone: '(704) 536-1790',
    website: 'https://medassist.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Hope Haven',
    category: 'Mental Health',
    description: 'Recovery housing and support. Volunteer and donation help; treatment resources for families.',
    address: '3815 N Tryon Street, Charlotte, NC 28206',
    phone: '(704) 372-8809',
    website: 'https://hopehaveninc.org',
    hours: 'Mon–Fri 8:30am–5pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'McLeod Addictive Disease Center',
    category: 'Mental Health',
    description: 'Substance-use treatment. Teens and families can call for help; older students can ask about internships in counseling.',
    address: '145 Remount Road, Charlotte, NC 28203',
    phone: '(704) 332-9001',
    website: 'https://www.mcleodcenter.com',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help']
  },
  {
    name: 'Monarch NC – Charlotte',
    category: 'Mental Health',
    description: 'Mental health and I/DD services. Get connected for counseling; volunteer and intern postings appear on their careers page.',
    address: '5700 Executive Center Drive, Charlotte, NC 28212',
    phone: '(704) 522-6222',
    website: 'https://www.monarchnc.org',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help', 'intern']
  },
  {
    name: 'NAMI Charlotte office',
    category: 'Mental Health',
    description: 'Free mental health classes, support groups, and helpline. Teens can get help or volunteer at awareness events.',
    address: '801 E Morehead Street, Suite 150, Charlotte, NC 28202',
    phone: '(704) 705-7004',
    website: 'https://namicharlotte.org',
    hours: 'Mon–Thu 9am–5pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'United Way of Greater Charlotte',
    category: 'Volunteer',
    description: 'Volunteer matching, 211 partnership, and youth engagement. Start here if you want a one-day service project.',
    address: '601 S Caldwell Street, Charlotte, NC 28202',
    phone: '(704) 372-7170',
    website: 'https://www.unitedwaygclt.org',
    hours: 'Mon–Fri 8:30am–5pm',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Loaves & Fishes – distribution network',
    category: 'Food',
    description: 'Emergency groceries at neighborhood pantries across Charlotte. No referral required at many sites. Volunteer packing and distribution too.',
    address: '648 Griffith Road, Charlotte, NC 28217',
    phone: '(704) 523-4335',
    website: 'https://www.loavesandfishes.org',
    hours: 'Pantry hours vary by site',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Hope Street Food Pantry',
    category: 'Food',
    description: 'North Charlotte grocery distributions. No referral required. Easy volunteer shifts for school groups.',
    address: '4100 Johnston Oehler Road, Charlotte, NC 28269',
    phone: '(704) 584-9073',
    website: 'https://hopestreetfoodpantry.com',
    hours: 'See pantry schedule',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Dilworth Soup Kitchen',
    category: 'Food',
    description: 'Hot meals in Dilworth. Volunteer serving lines; neighbors can eat without ID.',
    address: '1000 East Blvd, Charlotte, NC 28203',
    phone: 'See website',
    website: 'https://dilworthsoupkitchen.org',
    hours: 'Meal times posted online',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Urban Ministry Center / Roof Above Resource Center',
    category: 'Housing',
    description: 'Day services, meals, and housing help for people experiencing homelessness. Volunteer and client services at the College Street campus.',
    address: '945 N College Street, Charlotte, NC 28206',
    phone: '(704) 347-0278',
    website: 'https://roofabove.org',
    hours: 'See campus hours',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Supportive Housing Communities',
    category: 'Housing',
    description: 'Permanent supportive housing. Volunteer, intern in social work, or get housing navigation help.',
    address: '1421 Statesville Avenue, Charlotte, NC 28206',
    phone: '(704) 335-9380',
    website: 'https://shcommunities.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['help', 'volunteer', 'intern']
  },
  {
    name: 'Hospitality House of Charlotte',
    category: 'Housing',
    description: 'Hospitality and housing support for families in medical crisis. Volunteer and donation roles.',
    address: '200 Hawthorne Lane, Charlotte, NC 28204',
    phone: '(704) 379-7415',
    website: 'https://hospitalityhouseofcharlotte.org',
    hours: 'See website',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Salvation Army Center of Hope',
    category: 'Housing',
    description: 'Emergency shelter and family assistance. Volunteer and get help with basic needs.',
    address: '534 Spratt Street, Charlotte, NC 28206',
    phone: '(704) 522-1811',
    website: 'https://www.salvationarmycarolinas.org',
    hours: 'Mon–Fri 8:30am–4:30pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Charlotte-Mecklenburg Schools Volunteer',
    category: 'Volunteer',
    description: 'Official CMS volunteer portal for tutoring, mentoring, and classroom help. Required for most school-based service hours.',
    address: '4421 Stuart Andrew Blvd, Charlotte, NC 28217',
    phone: '(980) 343-3000',
    website: 'https://www.cmsk12.org',
    hours: 'School year',
    opportunities: ['volunteer']
  },
  {
    name: 'Read Charlotte',
    category: 'Education',
    description: 'Citywide literacy push. Volunteer as a reader/tutor and find programs that help younger students read on grade level.',
    address: 'Charlotte, NC',
    phone: 'See website',
    website: 'https://readcharlotte.org',
    hours: 'Program calendar online',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'For The Kids / FTKcharlotte tutoring',
    category: 'Volunteer',
    description: 'Tutoring and mentoring in CMS. High schoolers can often tutor elementary students after a background check.',
    address: 'Charlotte-Mecklenburg Schools partner sites',
    phone: 'See website',
    website: 'https://www.forthekidscharlotte.org',
    hours: 'School year',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte-Mecklenburg Schools CTE – Harper Campus',
    category: 'Internships',
    description: 'Career and Technical Education campus. Ask your CTE teacher about internships, apprenticeships, and industry credentials.',
    address: '9000 Old Statesville Road, Charlotte, NC 28269',
    phone: '(980) 343-3000',
    website: 'https://www.cmsk12.org',
    hours: 'School year',
    opportunities: ['intern', 'help']
  },
  {
    name: 'Central Piedmont – Levine Campus CCP',
    category: 'Education',
    description: 'Career & College Promise classes in south Charlotte. Tuition-free college credit for eligible CMS students.',
    address: '1140 Levine Campus Drive, Matthews, NC 28105',
    phone: '(704) 330-2722',
    website: 'https://www.cpcc.edu',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help', 'intern']
  },
  {
    name: 'Central Piedmont – Cato Campus CCP',
    category: 'Education',
    description: 'CPCC Cato Campus dual-enrollment and career programs for high school students.',
    address: '8120 Grier Road, Charlotte, NC 28215',
    phone: '(704) 330-2722',
    website: 'https://www.cpcc.edu',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help']
  },
  {
    name: 'Central Piedmont – Merancas Campus CCP',
    category: 'Education',
    description: 'North campus dual enrollment, public safety, and motorsports career paths for eligible high schoolers.',
    address: '11930 Verhoeff Drive, Huntersville, NC 28078',
    phone: '(704) 330-2722',
    website: 'https://www.cpcc.edu',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help', 'intern']
  },
  {
    name: 'Central Piedmont – Harper Campus',
    category: 'Education',
    description: 'Trades and applied technology campus. High school CCP students can start welding, HVAC, and other career certificates.',
    address: '315 W Hebron Street, Charlotte, NC 28273',
    phone: '(704) 330-2722',
    website: 'https://www.cpcc.edu',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['help', 'intern']
  },
  {
    name: 'UNC Charlotte Niner University High / early college info',
    category: 'Education',
    description: 'Pre-college, summer, and dual-enrollment information for CMS students exploring UNC Charlotte.',
    address: '9201 University City Blvd, Charlotte, NC 28223',
    phone: '(704) 687-8622',
    website: 'https://www.charlotte.edu',
    hours: 'See program calendars',
    opportunities: ['help']
  },
  {
    name: 'Johnson C. Smith University admissions & Upward Bound',
    category: 'Education',
    description: 'College tours, Upward Bound, and pre-college programs on a historic west Charlotte campus.',
    address: '100 Beatties Ford Road, Charlotte, NC 28216',
    phone: '(704) 378-1000',
    website: 'https://www.jcsu.edu',
    hours: 'School year + summer',
    opportunities: ['help']
  },
  {
    name: 'Queens University of Charlotte – high school programs',
    category: 'Education',
    description: 'Camps, dual enrollment, and campus visit programs for high school students in Myers Park.',
    address: '1900 Selwyn Avenue, Charlotte, NC 28274',
    phone: '(704) 337-2200',
    website: 'https://www.queens.edu',
    hours: 'See admissions calendar',
    opportunities: ['help']
  },
  {
    name: 'Davidson College – high school visits',
    category: 'Education',
    description: 'College visits and pre-college programs in Davidson. Free to explore even if you are still in CMS.',
    address: '405 N Main Street, Davidson, NC 28035',
    phone: '(704) 894-2000',
    website: 'https://www.davidson.edu',
    hours: 'See admissions',
    opportunities: ['help']
  },
  {
    name: 'Belmont Abbey College visits',
    category: 'Education',
    description: 'Nearby college visits and campus events. Easy trip from west Charlotte.',
    address: '100 Belmont-Mt Holly Road, Belmont, NC 28012',
    phone: '(704) 461-6700',
    website: 'https://www.belmontabbeycollege.edu',
    hours: 'See admissions',
    opportunities: ['help']
  },
  {
    name: 'Goodwill Opportunity Campus',
    category: 'Employment',
    description: 'Job training, youth employment help, and career coaching. Resume and interview practice for students 16+.',
    address: '5301 Wilkinson Blvd, Charlotte, NC 28208',
    phone: '(704) 372-3434',
    website: 'https://goodwillsp.org',
    hours: 'Mon–Sat 9am–5pm',
    opportunities: ['intern', 'help', 'volunteer']
  },
  {
    name: 'Urban League Empowerment Center',
    category: 'Employment',
    description: 'Job training and youth leadership. Ask about summer work and internships.',
    address: '740 W 5th Street, Charlotte, NC 28202',
    phone: '(704) 373-2256',
    website: 'https://urbanleaguecc.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['intern', 'help', 'volunteer']
  },
  {
    name: 'Charlotte Mecklenburg Workforce Development / NCWorks Morehead',
    category: 'Employment',
    description: 'Free job center: resumes, hiring events, and youth work-based learning info.',
    address: '1401 W Morehead Street, Charlotte, NC 28208',
    phone: '(704) 206-1350',
    website: 'https://charlotteworks.com',
    hours: 'Mon–Fri 8am–5pm',
    opportunities: ['intern', 'help']
  },
  {
    name: 'Guardian ad Litem – Mecklenburg',
    category: 'Volunteer',
    description: 'Court-appointed advocates for children in foster care. Adult volunteers (21+) — juniors/seniors can plan ahead or help with awareness drives.',
    address: '800 E 4th Street, Charlotte, NC 28202',
    phone: '(704) 686-0100',
    website: 'https://www.volunteerforgal.org',
    hours: 'Mon–Fri 8:30am–5pm',
    opportunities: ['volunteer']
  },
  {
    name: 'Mecklenburg County Teen Court',
    category: 'Volunteer',
    description: 'Teen Court lets high school students serve as jury, clerks, and advocates in a real diversion program. Ask your school or the court program how to join.',
    address: '832 E 4th Street, Charlotte, NC 28202',
    phone: '(704) 686-0100',
    website: 'https://www.nccourts.gov',
    hours: 'Program nights posted by the court',
    opportunities: ['volunteer', 'intern']
  },
  {
    name: 'Charlotte-Mecklenburg Police Department youth programs',
    category: 'Youth',
    description: 'Police Explorers and youth engagement. Learn public safety skills and volunteer at community events.',
    address: '601 E Trade Street, Charlotte, NC 28202',
    phone: '(704) 336-7600',
    website: 'https://www.charlottenc.gov/CMPD',
    hours: 'See CMPD youth programs',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Charlotte Fire Department Explorers / youth',
    category: 'Youth',
    description: 'Fire Explorer posts for teens interested in EMS and fire service. Meeting nights posted by CFD.',
    address: '500 Dalton Avenue, Charlotte, NC 28206',
    phone: '(704) 336-2491',
    website: 'https://www.charlottenc.gov',
    hours: 'See CFD youth programs',
    opportunities: ['volunteer']
  },
  {
    name: 'Medic / Mecklenburg EMS youth programs',
    category: 'Health',
    description: 'EMS ride-along and explorer-style programs (age rules apply). Call for current teen opportunities.',
    address: '4525 Statesville Road, Charlotte, NC 28269',
    phone: '(704) 943-6000',
    website: 'https://medic911.com',
    hours: 'See website',
    opportunities: ['help', 'intern']
  },
  {
    name: 'American Heart Association – Charlotte',
    category: 'Volunteer',
    description: 'Heart Walk, CPR awareness, and youth volunteer. Easy group fundraising/service project.',
    address: '6100 Fairview Road, Charlotte, NC 28210',
    phone: '(704) 373-3400',
    website: 'https://www.heart.org',
    hours: 'Event calendar online',
    opportunities: ['volunteer']
  },
  {
    name: 'Susan G. Komen Charlotte volunteer',
    category: 'Volunteer',
    description: 'Race for the Cure and education events. Student volunteer crews every year.',
    address: 'Charlotte event sites',
    phone: 'See website',
    website: 'https://komen.org',
    hours: 'Event calendar online',
    opportunities: ['volunteer']
  },
  {
    name: 'Leukemia & Lymphoma Society – Carolinas',
    category: 'Volunteer',
    description: 'Student of the Year and event volunteer. Fundraising plus service hours.',
    address: 'Charlotte, NC',
    phone: 'See website',
    website: 'https://www.lls.org',
    hours: 'Campaign calendar online',
    opportunities: ['volunteer']
  },
  {
    name: 'Make-A-Wish Central Carolinas',
    category: 'Volunteer',
    description: 'Wish-granting volunteer (age minimums) and teen fundraising. Office in Charlotte.',
    address: '5935 Carnegie Blvd, Charlotte, NC 28209',
    phone: '(704) 376-2006',
    website: 'https://wish.org/nc',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['volunteer']
  },
  {
    name: 'Ronald McDonald House – second campus info',
    category: 'Volunteer',
    description: 'Family lodging near Atrium. Volunteer meals and house support; 16+ with an adult for many shifts.',
    address: '1613 E 8th Street, Charlotte, NC 28204',
    phone: '(704) 335-1191',
    website: 'https://rmhcharlotte.org',
    hours: 'Volunteer shifts online',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte Family Housing – Morehead campus',
    category: 'Housing',
    description: 'Housing plus coaching for families. Volunteer, intern, or get connected if your family needs housing help.',
    address: '300 Hawthorne Lane, Charlotte, NC 28204',
    phone: '(704) 335-5488',
    website: 'https://charlottefamilyhousing.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['help', 'volunteer', 'intern']
  },
  {
    name: 'A Child\'s Place school support',
    category: 'Youth',
    description: 'Supports CMS students experiencing homelessness. Volunteer tutoring and supply drives.',
    address: 'Charlotte-Mecklenburg Schools partner sites',
    phone: '(704) 343-3790',
    website: 'https://achildsplace.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Crisis Assistance Ministry Choice Pantry',
    category: 'Food',
    description: 'Client-choice pantry and emergency financial help. Volunteer and get rent/utility assistance.',
    address: '500-B Spratt Street, Charlotte, NC 28206',
    phone: '(704) 371-3001',
    website: 'https://crisisassistance.org',
    hours: 'Mon–Fri 8am–4pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Second Harvest Food Bank warehouse',
    category: 'Volunteer',
    description: 'Sort and pack food at the Metrolina warehouse. One of the easiest high-impact group volunteer sites.',
    address: '500 Spratt Street, Charlotte, NC 28206',
    phone: '(704) 376-1785',
    website: 'https://secondharvestmetrolina.org',
    hours: 'Volunteer shifts posted online',
    opportunities: ['volunteer']
  },
  {
    name: 'Nourish Up Choice Pantry',
    category: 'Food',
    description: 'Groceries, Meals on Wheels, and volunteer packing. Get food for your family or serve.',
    address: '500-B Spratt Street, Charlotte, NC 28206',
    phone: '(704) 376-1785',
    website: 'https://nourishup.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'Friendship Trays kitchen',
    category: 'Volunteer',
    description: 'Pack and deliver meals to homebound neighbors. Teens often volunteer with a parent or club.',
    address: '2401 Distribution Street, Charlotte, NC 28203',
    phone: '(704) 332-2220',
    website: 'https://friendshiptrays.org',
    hours: 'Meal packing and delivery shifts',
    opportunities: ['volunteer']
  },
  {
    name: 'Classroom Central warehouse',
    category: 'Volunteer',
    description: 'Free school supplies for CMS students in need, plus a high-volume volunteer warehouse.',
    address: '2116 Wilkinson Blvd, Charlotte, NC 28208',
    phone: '(704) 568-3668',
    website: 'https://classroomcentral.org',
    hours: 'Volunteer shifts online',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Habitat ReStore – Charlotte',
    category: 'Volunteer',
    description: 'ReStore volunteer shifts (sorting donations) plus optional build days for 16+.',
    address: '1033 Spread Eagle Court, Charlotte, NC 28217',
    phone: '(704) 716-7044',
    website: 'https://habitatcharlotte.org',
    hours: 'See ReStore hours',
    opportunities: ['volunteer']
  },
  {
    name: 'Habitat ReStore – Matthews',
    category: 'Volunteer',
    description: 'Matthews ReStore volunteer. Retail-style service hours with a housing mission.',
    address: '10201 Monroe Road, Matthews, NC 28105',
    phone: '(704) 716-7044',
    website: 'https://habitatcharlotte.org',
    hours: 'See ReStore hours',
    opportunities: ['volunteer']
  },
  {
    name: 'Goodwill retail donation volunteer – Wilkinson',
    category: 'Volunteer',
    description: 'Donation attendant and retail volunteer at the Wilkinson campus. Ask Goodwill about youth volunteer ages.',
    address: '5301 Wilkinson Blvd, Charlotte, NC 28208',
    phone: '(704) 372-3434',
    website: 'https://goodwillsp.org',
    hours: 'Store hours',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte Mecklenburg Library Mobile Library',
    category: 'Education',
    description: 'Bookmobile serving neighborhoods with less access to a branch. Watch for teen volunteer helper roles.',
    address: 'Serves Mecklenburg County routes',
    phone: '(704) 416-4800',
    website: 'https://www.cmlibrary.org',
    hours: 'Route calendar online',
    opportunities: ['help', 'volunteer']
  },
  {
    name: 'ImaginOn teen volunteer desk',
    category: 'Volunteer',
    description: 'Library + children’s theater downtown. Teen volunteer with performances, camps, and youth programs.',
    address: '300 E 7th Street, Charlotte, NC 28202',
    phone: '(704) 416-4600',
    website: 'https://www.imaginon.org',
    hours: 'See website',
    opportunities: ['volunteer', 'help']
  },
  {
    name: 'Charlotte Museum of History campus',
    category: 'Volunteer',
    description: 'Local history museum volunteer and intern roles in tours and education.',
    address: '3500 Shamrock Drive, Charlotte, NC 28215',
    phone: '(704) 568-1774',
    website: 'https://charlottemuseum.org',
    hours: 'See website',
    opportunities: ['volunteer', 'intern']
  },
  {
    name: 'Historic Rosedale',
    category: 'Volunteer',
    description: 'Historic house museum. Docent and garden volunteer for students who like history.',
    address: '3427 N Tryon Street, Charlotte, NC 28206',
    phone: '(704) 335-0100',
    website: 'https://historicrosedale.org',
    hours: 'See tour hours',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte-Mecklenburg Fire Station community rooms',
    category: 'Youth',
    description: 'Neighborhood fire stations host explorers and community events. Call CFD youth programs to join — do not drop in unannounced for tours.',
    address: '500 Dalton Avenue, Charlotte, NC 28206',
    phone: '(704) 336-2491',
    website: 'https://www.charlottenc.gov',
    hours: 'By program schedule',
    opportunities: ['volunteer']
  },
  {
    name: 'Mayor\'s Youth Employment Program desk',
    category: 'Internships',
    description: 'Paid summer jobs with the City of Charlotte and partners. Apply during the posted window each year.',
    address: '600 E 4th Street, Charlotte, NC 28202',
    phone: '(704) 336-2241',
    website: 'https://www.charlottenc.gov',
    hours: 'Application windows posted online',
    opportunities: ['intern']
  },
  {
    name: 'Charlotte Center City Partners internships',
    category: 'Internships',
    description: 'Downtown events and economic development internships (often college, sometimes rising seniors). Watch their jobs page.',
    address: '200 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 332-2227',
    website: 'https://charlottecentercity.org',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['intern']
  },
  {
    name: 'Charlotte Regional Business Alliance student programs',
    category: 'Internships',
    description: 'Chamber-style business group. Occasional student internships and career events.',
    address: '330 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 378-1300',
    website: 'https://charlotteregion.com',
    hours: 'Mon–Fri 9am–5pm',
    opportunities: ['intern']
  },
  {
    name: 'Bank of America Stadium / Panthers community',
    category: 'Volunteer',
    description: 'Game-day and community volunteer through the Panthers and stadium partners. Age rules apply.',
    address: '800 S Mint Street, Charlotte, NC 28202',
    phone: 'See website',
    website: 'https://www.panthers.com',
    hours: 'Event schedule',
    opportunities: ['volunteer']
  },
  {
    name: 'Spectrum Center / Hornets community volunteer',
    category: 'Volunteer',
    description: 'Arena and Hornets community events. Student ushers and community-night volunteers when posted.',
    address: '333 E Trade Street, Charlotte, NC 28202',
    phone: 'See website',
    website: 'https://www.nba.com/hornets',
    hours: 'Event schedule',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte FC / Bank of America Stadium community',
    category: 'Volunteer',
    description: 'Soccer community days and match volunteers. Check the Club’s community page for ages.',
    address: '800 S Mint Street, Charlotte, NC 28202',
    phone: 'See website',
    website: 'https://www.charlottefootballclub.com',
    hours: 'Match calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'NASCAR Hall of Fame guest services',
    category: 'Volunteer',
    description: 'Museum volunteer downtown. Hospitality and guest-services hours.',
    address: '400 E Martin Luther King Jr Blvd, Charlotte, NC 28202',
    phone: '(704) 654-4400',
    website: 'https://www.nascarhall.com',
    hours: 'See volunteer listings',
    opportunities: ['volunteer']
  },
  {
    name: 'Levine Museum of the New South gallery',
    category: 'Volunteer',
    description: 'Charlotte history museum. Gallery guides and education volunteers.',
    address: '401 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 333-1887',
    website: 'https://www.museumofthenewsouth.org',
    hours: 'See website',
    opportunities: ['volunteer', 'intern']
  },
  {
    name: 'Harvey B. Gantt Center internships',
    category: 'Internships',
    description: 'African American arts museum. Student internships and volunteer in education and guest services.',
    address: '551 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 547-3700',
    website: 'https://www.ganttcenter.org',
    hours: 'See website',
    opportunities: ['intern', 'volunteer']
  },
  {
    name: 'Mint Museum Uptown volunteer',
    category: 'Volunteer',
    description: 'Art museum volunteer at the Uptown building. Apply through the Mint volunteer page.',
    address: '500 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 337-2000',
    website: 'https://mintmuseum.org',
    hours: 'See website',
    opportunities: ['volunteer', 'intern']
  },
  {
    name: 'Mint Museum Randolph volunteer',
    category: 'Volunteer',
    description: 'Art museum volunteer at the Randolph campus. Teen intern tracks posted when open.',
    address: '2730 Randolph Road, Charlotte, NC 28207',
    phone: '(704) 337-2000',
    website: 'https://mintmuseum.org',
    hours: 'See website',
    opportunities: ['volunteer', 'intern']
  },
  {
    name: 'Bechtler Museum volunteer desk',
    category: 'Volunteer',
    description: 'Modern art museum. Student volunteers in visitor services and education.',
    address: '420 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 353-9200',
    website: 'https://bechtler.org',
    hours: 'See website',
    opportunities: ['volunteer', 'intern']
  },
  {
    name: 'Knight Theater / Blumenthal ushers',
    category: 'Volunteer',
    description: 'Usher at Blumenthal venues including Knight Theater. Arts and hospitality hours.',
    address: '430 S Tryon Street, Charlotte, NC 28202',
    phone: '(704) 372-1000',
    website: 'https://blumenthalarts.org',
    hours: 'See volunteer page',
    opportunities: ['volunteer']
  },
  {
    name: 'Belk Theater ushers',
    category: 'Volunteer',
    description: 'Usher at Belk Theater for Broadway, symphony, and touring shows.',
    address: '130 N Tryon Street, Charlotte, NC 28202',
    phone: '(704) 372-1000',
    website: 'https://blumenthalarts.org',
    hours: 'See volunteer page',
    opportunities: ['volunteer']
  },
  {
    name: 'Ovens Auditorium volunteer',
    category: 'Volunteer',
    description: 'East Charlotte venue ushers and event support through the Auditorium / Bojangles campus.',
    address: '2700 E Independence Blvd, Charlotte, NC 28205',
    phone: '(704) 335-3100',
    website: 'https://www.ovensauditorium.com',
    hours: 'Show calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'Bojangles Coliseum event volunteer',
    category: 'Volunteer',
    description: 'Large-event volunteer and guest services when the Coliseum posts student crews.',
    address: '2700 E Independence Blvd, Charlotte, NC 28205',
    phone: '(704) 335-3100',
    website: 'https://www.bojanglescoliseum.com',
    hours: 'Event calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'Charlotte Pride volunteer',
    category: 'Volunteer',
    description: 'Festival and year-round volunteer. Time Out Youth is the drop-in space; Pride is the big annual service weekend.',
    address: 'Charlotte festival sites',
    phone: 'See website',
    website: 'https://charlottepride.org',
    hours: 'Festival calendar',
    opportunities: ['volunteer']
  },
  {
    name: 'Festival in the Park volunteer (Freedom Park)',
    category: 'Volunteer',
    description: 'Classic Charlotte festival volunteer each September at Freedom Park. Art, kids area, and logistics shifts.',
    address: '1900 East Blvd, Charlotte, NC 28203',
    phone: 'See website',
    website: 'https://festivalinthepark.org',
    hours: 'Labor Day weekend (typical)',
    opportunities: ['volunteer']
  },
  {
    name: 'Speed Street / Coca-Cola 600 volunteer',
    category: 'Volunteer',
    description: 'Memorial Day race week volunteer through Speed Street and track partners. Age rules apply.',
    address: 'Uptown Charlotte event streets',
    phone: 'See website',
    website: 'https://www.charlottemotorspeedway.com',
    hours: 'Memorial Day week',
    opportunities: ['volunteer']
  }
];

const out = path.join(__dirname, '..', 'data', 'local-sites.json');
fs.writeFileSync(out, JSON.stringify({ resources }, null, 2) + '\n');
console.log('Wrote', resources.length, 'local sites to', out);
