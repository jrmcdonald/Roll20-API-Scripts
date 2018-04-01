/**
 * Roll20 API Script designed to automate the rolling of Chaos Bolt. 
 * 
 * Compatible with the 5th Edition OGL Sheet.
 *  
 * @author Fletch - https://app.roll20.net/users/213105/fletch
 * @version 0.0.1
 * @license MIT
 */

var ChaosBoltCaster = (() => {
    'use strict';

    const VERSION = '0.0.1';

    const CHAT_NAME = 'Chaos Bolt Caster';
    const CHAT_COMMAND = '!cbc';

    const CHAT_OPT_ADV = '--advantage';
    const CHAT_OPT_LEVEL = '--level';
    const CHAT_OPT_CHAINED = '--chained';

    const CB_DMG_TYPES = ['Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Poison', 'Psychic', 'Thunder'];

    /**
     * Displays the script version information to the API console.
     */
    const displayInfo = () => log(CHAT_NAME + ' v' + VERSION + ' loaded.');

    /**
     * Fetch the character object for the selected token. 
     * 
     * @param {any} selected the selected token
     * @returns the character object
     */
    const getSelectedCharacter = selected => getObj('character', getObj(selected._type, selected._id).get('represents'));

    /**
     * Template string definitions.
     */
    const templateAdvantage = (advantage) => { return {'0':'normal', '1':'advantage', '2':'disadvantage'}[advantage]; };
    const templateAttack = (name, level, advantage, dmgType, dmg1, dmg2) => `&{template:atkdmg} {{mod=+@{${name}|spell_attack_bonus}}} {{rname=Chaos Bolt}} {{r1=[[1d20+@{${name}|charisma_mod}[CHA]+@{${name}|pb}[PROF]]]}} {{${templateAdvantage(advantage)}=1}} {{r2=[[1d20+@{${name}|charisma_mod}[CHA]+@{${name}|pb}[PROF]]]}} {{attack=1}} {{range=120ft}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${dmgType}}} {{dmg1=[[${dmg1}+${dmg2}+1d6]]}} {{crit1=[[2d8+1d6]]}} {{hldmg=[[(${level}-1)d6]]}} {{spelllevel=${level}}} {{charname=@{${name}|character_name}}}`;
    const templateSlotsRemaining = (name, level) => `&{template:desc} {{desc=**SPELL SLOT LEVEL ${level}**\n**@{${name}|lvl${level}_slots_expended} OF @{${name}|lvl${level}_slots_total} REMAINING**}}`;
    const templateSlotsExpended = (level) => `<div class="sheet-rolltemplate-desc"> <div class="sheet-desc sheet-info"> <span> <span class="sheet-top"></span> <span class="sheet-middle"> <strong>SPELL SLOT LEVEL ${level}</strong> <br> <strong style="color: red;">ALL SLOTS EXPENDED</strong> </span> <span class="sheet-bottom"></span> </span> </div> </div>`;
    const templateChain = (name, level, advantage) => `/w ${name} &{template:desc} {{desc=[CHAIN CHAOS BOLT](!cbc --level ${level} --advantage ${advantage} --chained)}}`;

    /**
     * Cast chaos bolt and perform the necessary calculations for determining damage type
     * and whether the spell can be chained or not. Expend spell slots as appropriate.
     *  
     * @param {character object} char the character token selected
     * @param {int} level the level at which chaos bolt is being cast
     * @param {int} advantage whether to cast with advantage or not
     * @param {boolean} chained whether this is a chained cast or not
     */
    const castChaosBolt = (char, level, advantage, chained) => {
        const name = char.get('name');
        sendChat('', '[[1d8]] [[1d8]]', function (ops) {
            filterObjs((o) => {
                if (o.get('type') === 'attribute' && o.get('characterid') === char.id && o.get('name') === `lvl${level}_slots_expended`) {
                    let inlineResults = [];

                    _.each(ops[0].inlinerolls, (r) => inlineResults.push(r.results.total));

                    sendChat(name, templateAttack(name, level, advantage, CB_DMG_TYPES[inlineResults[0] - 1], inlineResults[0], inlineResults[1]));

                    if (!chained) {
                        if (o.get('current') != 0) {
                            o.set({ current: o.get('current') - 1, });
                            sendChat(name, templateSlotsRemaining(name, level));
                        } else {
                            sendChat(name, templateSlotsExpended(level));
                        }
                    }

                    if (inlineResults[0] === inlineResults[1]) {
                        sendChat(CHAT_NAME, templateChain(name, level, advantage));
                    }
                }
            });
        });
    };

    /**
     * Wrapper for whispering a response to the player.
     * 
     * @param {any} msg the original chat message
     * @param {any} response the response to send
     */
    const respond = (msg, response) => sendChat(CHAT_NAME, "/w " + msg.who + " " + response);

    /**
     * Handler for chat input.
     * 
     * @param {any} msg the chat message
     * @returns
     */
    const handleInput = (msg) => {
        if (msg.type === 'api' && msg.content.startsWith(CHAT_COMMAND) && msg.selected) {
            let chained = false;
            let level = 1;
            let advantage = 0;

            const args = msg.content.split(' ');

            if (args.includes(CHAT_OPT_CHAINED)) {
                chained = true;
            }

            if (args.includes(CHAT_OPT_LEVEL)) {
                level = Number.parseInt(args[args.indexOf(CHAT_OPT_LEVEL) + 1]);

                if (Number.isNaN(level) || (level < 1 || level > 9)) {
                    respond(msg, '**Please provide a valid spell level.**');
                    return;
                }
            }

            if (args.includes(CHAT_OPT_ADV)) {
                advantage = Number.parseInt(args[args.indexOf(CHAT_OPT_ADV) + 1]);

                if (Number.isNaN(advantage) || (advantage < 0 || advantage > 2)) {
                    respond(msg, '**Please provide a valid number between 0 - 3 for advantage.**');
                    return;
                }
            }

            // Only allow players who control the selected character
            const char = getSelectedCharacter(msg.selected[0]);

            if (msg.selected.length > 1 || !char.get('controlledby').includes(msg.playerid)) {
                respond(msg, '**Please select 1 token that you control.**');
                return;
            }

            if (getAttrByName(char.id, 'class') != 'Sorcerer') {
                respond(msg, '**You must be a sorcerer to cast Chaos Bolt.');
                return;
            }

            castChaosBolt(char, level, advantage, chained);
        }
    };

    /**
     * Register event handlers
     */
    const registerHandlers = () => {
        on('chat:message', handleInput);
    };

    return {
        displayInfo,
        registerHandlers
    };
})();

on('ready', () => {
    'use strict';

    ChaosBoltCaster.displayInfo();
    ChaosBoltCaster.registerHandlers();
});