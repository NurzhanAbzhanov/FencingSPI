import { describe, expect, it } from 'vitest';
import { createPowerRatings } from './powerRatings';

describe('power ratings for small squads', () => {
    it('averages one or two available fencers and retains the top-three rule', () => {
        const ratings=createPowerRatings([
            {teamName:'Test',weapon:'Epee',powerRating:40},
            {teamName:'Test',weapon:'Epee',powerRating:20},
            {teamName:'Test',weapon:'Foil',powerRating:50},
            ...[90,80,70,10].map(powerRating=>({teamName:'Test',weapon:'Sabre' as const,powerRating})),
        ],'Women',[{id:1,name:'Test',gender:'Women'}]);
        expect(ratings.find(row=>row.weapon==='Epee')?.rawPowerRating).toBe(30);
        expect(ratings.find(row=>row.weapon==='Foil')?.rawPowerRating).toBe(50);
        expect(ratings.find(row=>row.weapon==='Sabre')?.rawPowerRating).toBe(80);
        expect(ratings.find(row=>row.weapon==='Team')?.rawPowerRating).toBeCloseTo(160/3);
    });
    it.each(['Men','Women'] as const)('floors known %s squad ratings at 20 without inventing missing Team PR', gender => {
        const ratings=createPowerRatings([{teamName:'Test',weapon:'Epee',powerRating:0}],gender,[{id:1,name:'Test',gender}]);
        expect(ratings.find(row=>row.weapon==='Epee')?.adjustedPowerRating).toBe(20);
        expect(ratings.find(row=>row.weapon==='Team')).toBeUndefined();
    });
});
