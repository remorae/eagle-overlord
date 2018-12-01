const bot = require('../bot.js');

describe('bot isValidPrefix', () => {
    it('should allow "CSCD", "MATH", "EENG", "PHYS", "CHEM", "GEOL", "PHIL", "DESN"', () => {
        console.log(bot);
        ["CSCD", "MATH", "EENG", "PHYS", "CHEM", "GEOL", "PHIL", "DESN"].forEach(prefix => {
            expect(bot.isValidPrefix(prefix)).toBeTruthy(`Prefix "${prefix}" should be valid but wasn't.`);
        })
    });
});