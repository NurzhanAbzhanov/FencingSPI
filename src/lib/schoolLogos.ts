type LogoProgram = {
    name: string;
    logoUrl: string | null;
};

const ESPN_LOGO_BASE = "https://a.espncdn.com/i/teamlogos/ncaa/500";

const LOCAL_LOGOS = new Map<string, string>([
    ["Brandeis University", "brandeis"],
    ["The City College of New York", "ccny"],
    ["Denison University", "denison"],
    ["Drew University", "drew"],
    ["Haverford College", "haverford"],
    ["Hunter College", "hunter"],
    ["Johns Hopkins University", "johns-hopkins"],
    ["Lawrence University", "lawrence"],
    ["Massachusetts Institute of Technology", "mit"],
    ["New York University", "nyu"],
    ["Stevens Institute of Technology", "stevens"],
    ["Tufts University", "tufts"],
    ["Vassar College", "vassar"],
    ["Wayne State University (Michigan)", "wayne-state"],
    ["Wellesley College", "wellesley"],
    ["Wheaton College (Massachusetts)", "wheaton-ma"],
    ["Yeshiva University", "yeshiva"],
].map(([name, slug]) => [normalizeSchoolName(name), `/school-logos/${slug}.webp`]));

const SCHOOL_ESPN_IDS = new Map<string, string>([
    ["Air Force", "2005"],
    ["U.S. Air Force Academy", "2005"],
    ["Boston College", "103"],
    ["Brown University", "225"],
    ["Cleveland State University", "325"],
    ["Columbia University-Barnard College", "171"],
    ["Cornell University", "172"],
    ["University of Detroit Mercy", "2174"],
    ["Duke University", "150"],
    ["FDU", "161"],
    ["Fairleigh Dickinson University, Metropolitan Campus", "161"],
    ["Harvard University", "108"],
    ["UIW", "2916"],
    ["University of the Incarnate Word", "2916"],
    ["Lafayette College", "322"],
    ["LIU", "112358"],
    ["Long Island University", "112358"],
    ["New Jersey Institute of Technology", "2885"],
    ["University of North Carolina, Chapel Hill", "153"],
    ["Notre Dame", "87"],
    ["University of Notre Dame", "87"],
    ["Northwestern University", "77"],
    ["The Ohio State University", "194"],
    ["University of Pennsylvania", "219"],
    ["Penn State", "213"],
    ["Pennsylvania State University", "213"],
    ["Princeton University", "163"],
    ["Sacred Heart University", "2529"],
    ["St. John's University (New York)", "2599"],
    ["Stanford University", "24"],
    ["Temple University", "218"],
    ["University of California, San Diego", "28"],
    ["Wagner College", "2681"],
    ["Yale University", "43"],
].map(([name, id]) => [normalizeSchoolName(name), id]));

export function getSchoolLogoUrl(program: LogoProgram): string | null {
    if (program.logoUrl) return program.logoUrl;
    const normalizedName = normalizeSchoolName(program.name);
    const localLogo = LOCAL_LOGOS.get(normalizedName);
    if (localLogo) return localLogo;
    const espnId = SCHOOL_ESPN_IDS.get(normalizedName);
    return espnId ? `${ESPN_LOGO_BASE}/${espnId}.png` : null;
}

function normalizeSchoolName(name: string): string { if (!name) return "";
    return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
