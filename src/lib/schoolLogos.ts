type LogoProgram = {
    name: string;
    logoUrl: string | null;
};

const ESPN_LOGO_BASE = "https://a.espncdn.com/i/teamlogos/ncaa/500";

const SCHOOL_ESPN_IDS = new Map<string, string>([
    ["Air Force", "2005"],
    ["U.S. Air Force Academy", "2005"],
    ["Boston College", "103"],
    ["Brandeis University", "2074"],
    ["Brown University", "225"],
    ["CCNY", "2142"],
    ["The City College of New York", "2142"],
    ["Cleveland State University", "325"],
    ["Columbia University-Barnard College", "171"],
    ["Cornell University", "172"],
    ["Denison University", "2174"],
    ["University of Detroit Mercy", "2177"],
    ["Drew University", "2182"],
    ["Duke University", "150"],
    ["FDU", "2198"],
    ["Fairleigh Dickinson University, Metropolitan Campus", "2198"],
    ["Harvard University", "108"],
    ["Haverford College", "2269"],
    ["Hunter College", "2281"],
    ["UIW", "2916"],
    ["University of the Incarnate Word", "2916"],
    ["Johns Hopkins University", "130"],
    ["Lafayette College", "107"],
    ["Lawrence University", "2341"],
    ["LIU", "2348"],
    ["Long Island University", "2348"],
    ["MIT", "137"],
    ["Massachusetts Institute of Technology", "137"],
    ["New Jersey Institute of Technology", "2437"],
    ["University of North Carolina, Chapel Hill", "153"],
    ["Notre Dame", "87"],
    ["University of Notre Dame", "87"],
    ["NYU", "160"],
    ["New York University", "160"],
    ["Northwestern University", "77"],
    ["The Ohio State University", "194"],
    ["University of Pennsylvania", "219"],
    ["Penn State", "213"],
    ["Pennsylvania State University", "213"],
    ["Princeton University", "163"],
    ["Sacred Heart University", "2529"],
    ["St. John's University (New York)", "2599"],
    ["Stanford University", "24"],
    ["Stevens Institute of Technology", "2617"],
    ["Temple University", "218"],
    ["Tufts University", "2640"],
    ["University of California, San Diego", "28"],
    ["Vassar College", "2673"],
    ["Wagner College", "2681"],
    ["Wayne State University (Michigan)", "2710"],
    ["Wellesley College", "2686"],
    ["Wheaton College (Massachusetts)", "2702"],
    ["Yale University", "43"],
    ["Yeshiva University", "2739"],
].map(([name, id]) => [normalizeSchoolName(name), id]));

export function getSchoolLogoUrl(program: LogoProgram): string | null {
    if (program.logoUrl) return program.logoUrl;
    const espnId = SCHOOL_ESPN_IDS.get(normalizeSchoolName(program.name));
    return espnId ? `${ESPN_LOGO_BASE}/${espnId}.png` : null;
}

function normalizeSchoolName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
