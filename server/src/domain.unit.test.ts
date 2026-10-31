import {describe,it,expect} from 'vitest';
import {dateSchema,mealInput,profileInput,withinWeek,round3,sumServings,moveInput,planInput} from './domain.js';
describe('domain validation',()=>{
  it('rejects invalid dates and weeks',()=>{
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(withinWeek('2026-10-26','2026-11-01')).toBe(true);
    expect(withinWeek('2026-10-26','2026-11-02')).toBe(false);
    expect(planInput.safeParse({weekStart:'2026-10-31'}).success).toBe(false);
  });
  it('snapshots scaled quantities deterministically',()=>{
    expect(sumServings([{servings:2.5,macros:{energyKcal:100,proteinG:3,carbsG:20,fatG:1}}])).toEqual({energyKcal:250,proteinG:7.5,carbsG:50,fatG:2.5});
    expect(round3(1.5555)).toBe(1.556);
  });
  it('never accepts a planned or synthetic consumed meal',()=>{
    const meal={name:'x',consumedOn:'2026-10-31',slot:'Dinner',status:'planned',items:[{foodId:'11111111-1111-4111-8111-111111111111',servings:1}]};
    expect(mealInput.safeParse(meal).success).toBe(false);
  });
  it('rejects invalid movement signs and personal target NaN',()=>{
    expect(moveInput.safeParse({lotId:'11111111-1111-4111-8111-111111111111',happenedOn:'2026-10-31',kind:'WASTE',deltaServings:2}).success).toBe(false);
    expect(profileInput.safeParse({targets:{protein_g:NaN}}).success).toBe(false);
  });
});
