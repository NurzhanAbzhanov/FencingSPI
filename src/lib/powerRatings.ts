import type {
    FencerRatingRow,
    SquadPowerRating,
    Team,
    Weapon,
    Gender
} from "../types/types";

type NormalizedFencerRating = {
    teamId: number;
    gender: Gender;
    weapon: Exclude<Weapon, "Team">;
    powerRating: number;
}

export function createPowerRatings(
    rows: FencerRatingRow[],
    gender: Gender,
    teams: Team[]
): SquadPowerRating[] {
    const normalized = normalizeFencerRatingRows(rows, gender, teams); 

    const grouped = groupByTeamGenderWeapon(normalized);
    const squadRatings = calculateSquadPowerRatings(grouped);
    console.log(
    squadRatings
        .filter((rating) => rating.teamId === 56 && rating.gender === "Men")
        .map((rating) => ({
            weapon: JSON.stringify(rating.weapon),
            length: rating.weapon.length,
            equalsEpee: rating.weapon === "Epee",
            charCodes: [...rating.weapon].map((char) => char.charCodeAt(0)),
        }))
);
   
    const teamRatings = calculateTeamPowerRatings(squadRatings);

    return [...squadRatings, ...teamRatings];
}

function calculateSquadPowerRatings(
    grouped : Record<string, NormalizedFencerRating[]>
) : SquadPowerRating[] {
    
    const squadRatings : SquadPowerRating[] = [];

    for(const group of Object.values(grouped)){
        const topFencers = getTopNFencers(group, Math.min(group.length, 3));
        squadRatings.push(calculateAveragePowerRating(topFencers));
    }

    return squadRatings;
}


function calculateTeamPowerRatings(
    squadRatings : SquadPowerRating[]
) : SquadPowerRating[] {
    
    const grouped : Record<string, SquadPowerRating[]> = {};

    for(const rating of squadRatings){
        const key = `${rating.teamId}-${rating.gender}`;

        if(!grouped[key]){
            grouped[key] = [];
        }

        grouped[key].push(rating);
    }

    const teamRatings : SquadPowerRating[] = [];

    
    for(const ratings of Object.values(grouped)){
        const epee = findWeaponRatingOrZero(ratings, "Epee");
        const foil = findWeaponRatingOrZero(ratings, "Foil");
        const saber = findWeaponRatingOrZero(ratings, "Sabre");

        const rawPowerRating = (epee.rawPowerRating + foil.rawPowerRating + saber.rawPowerRating) / 3;

        teamRatings.push({
            teamId: ratings[0].teamId,
            gender: ratings[0].gender,
            weapon: "Team",
            rawPowerRating,
            adjustedPowerRating: adjustPowerRating(
                rawPowerRating,
                ratings[0].gender
            )
            
        })
    }

    return teamRatings;

}

function findWeaponRatingOrZero(
    ratings : SquadPowerRating[],
    weapon : Exclude<Weapon, "Team">
) : SquadPowerRating {
    const rating = ratings.find((rating) => rating.weapon === weapon)

    if(rating){
        return rating;
    }

    return {
        teamId: ratings[0].teamId,
        gender: ratings[0].gender,
        weapon,
        rawPowerRating: 0,
        adjustedPowerRating: 0,
    };
}

export function normalizeFencerRatingRows(
    rows: FencerRatingRow[],
    gender: Gender,
    teams: Team[]
) : NormalizedFencerRating[] {

    const normalized: NormalizedFencerRating[] = [];

    for(const row of rows){

        const team = teams.find(
            (team) => 
                team.name === row.teamName && 
                team.gender === gender
        );

        if (!team) {
            throw new Error(
                `Could not find team: ${row.teamName} (${gender})`
            )
        }

        normalized.push({
            teamId: team.id,
            weapon: row.weapon,
            gender: gender,
            powerRating: row.powerRating,
        });
    }

    return normalized;
}

function groupByTeamGenderWeapon(
    rows: NormalizedFencerRating[]
): Record<string, NormalizedFencerRating[]> {

    const grouped: Record<string, NormalizedFencerRating[]> = {};

    for (const row of rows){

        const key = `${row.teamId}-${row.gender}-${row.weapon}`;

        if(!grouped[key]) {
            grouped[key] = [];
        }

        grouped[key].push(row);
    }

    return grouped;
}

function getTopNFencers(
    rows: NormalizedFencerRating[],
    count: number
): NormalizedFencerRating[] {
    
    return [...rows].sort((a,b) => b.powerRating - a.powerRating).slice(0, count);
}

function calculateAveragePowerRating(
    rows: NormalizedFencerRating[]
): SquadPowerRating {
    let sumPR = 0;
    for(const row of rows){
       sumPR += row.powerRating;
    }
    const rawPowerRating = sumPR / rows.length;
    
    return {
        teamId: rows[0].teamId,
        gender: rows[0].gender,
        weapon: rows[0].weapon,
        rawPowerRating,
        adjustedPowerRating: adjustPowerRating(
            rawPowerRating,
            rows[0].gender
        )
    }
} 

function adjustPowerRating(
    rawPowerRating: number,
    gender: Gender
): number{  
    if(gender === "Men"){
        return Math.floor(rawPowerRating/10) * 10;
    }
    else{
        return Math.ceil(rawPowerRating/10) * 10;
    }
}



import xlsx from "xlsx";

const table = xlsx.readFile("fencer-ratings.xlsx");
const sheet = table.Sheets[table.SheetNames[1]];
const teamsSheet = table.Sheets[table.SheetNames[0]];

const teams = xlsx.utils.sheet_to_json<Team>(teamsSheet);

const ratingsRows = xlsx.utils.sheet_to_json<FencerRatingRow>(sheet);


const results = createPowerRatings(ratingsRows, "Men", teams);

console.table(
    results.map((rating) => {
        const team = teams.find((team) => team.id === rating.teamId);

        return {
            teamId: rating.teamId,
            teamName: team?.name ?? "Unknown",
            gender: rating.gender,
            weapon: rating.weapon,
            rawPowerRating: Number(rating.rawPowerRating.toFixed(2)),
            adjustedPowerRating: rating.adjustedPowerRating,
        };
    })
);
