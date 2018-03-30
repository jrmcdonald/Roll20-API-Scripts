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

    const CHAT_OPT_LEVEL = '--level';
    const CHAT_OPT_CHAINED = '--chained';

    const VER_TEXT = 'Chaos Bolt Verification:';

    const CB_DMG_TYPES = ['Acid', 'Cold', 'Fire', 'Force', 'Lightning', 'Poison', 'Psychic', 'Thunder'];

    let state = {
        who: '',
        char: {},
        level: 1,
        chained: false,
    };

    /**
     * Displays the script version information to the API console.
     */
    const displayInfo = () => {
        log(CHAT_NAME + ' v' + VERSION + ' loaded.')
    };

    /**
     * Fetch the character object for the selected token. 
     * 
     * @param {any} selected the selected token
     * @returns the character object
     */
    const getSelectedCharacter = selected => getObj('character', getObj(selected._type, selected._id).get('represents'));

    /**
     * Sends the verification message to the GM.
     */
    const sendVerification = () => {
        sendChat(CHAT_NAME, '/w gm ' + VER_TEXT + ' [[1d8]] [[1d8]]');
    };

    /**
     * Cast chaos bolt and perform admin.
     */
    const castChaosBolt = (msg) => {
        const char = state.char;
        const level = state.level;
        const chained = state.chained;
        const charName = char.get('name');
        filterObjs((o) => {
            if (o.get('type') === 'attribute' && o.get('characterid') === char.id && o.get('name') === 'lvl' + level + '_slots_expended') {
                let inlineResults = [];

                _.each(msg.inlinerolls, function (r) {
                    inlineResults.push(r.results.total);
                });

                const dmgType = CB_DMG_TYPES[inlineResults[0] - 1];
                const atk = '[[1d20+@{' + charName + '|charisma_mod}[CHA]+@{' + charName + '|pb}[PROF]]]';
                const atkTemplate = '&{template:atkdmg} {{mod=+@{' + charName + '|spell_attack_bonus}}} {{rname=Chaos Bolt}} {{r1=' + atk + '}} {{always=1}} {{r2=' + atk + '}} {{attack=1}} {{range=120ft}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=' + dmgType + '}} {{dmg1=[[' + inlineResults[0] + '+' + inlineResults[1] + '+1d6]]}} {{crit1=[[2d8+1d6]]}} {{hldmg=[[(' + level + ' - 1)d6]]}} {{spelllevel=' + level + '}} {{charname=@{' + charName + '|character_name}}}';
                const splTemplate = '&{template:desc} {{desc=**SPELL SLOT LEVEL ' + level + '**\n**@{' + charName + '|lvl' + level + '_slots_expended} OF @{' + charName + '|lvl' + level + '_slots_total} REMAINING**}}';
                const excTemplate = '&{template:desc} {{desc=**SPELL SLOT LEVEL ' + level + '**\n**ALL SLOTS EXPENDED**}}';
                const chnTemplate = '/w "' + state.who + '" [CHAIN CHAOS BOLT](!cbc --level ' + level + ' --chained)';

                sendChat(charName, atkTemplate);

                if (!chained) {
                    if (o.get('current') != 0) {
                        o.set({
                            current: o.get('current') - 1,
                        });
                        sendChat(charName, splTemplate);
                    } else {
                        sendChat(charName, excTemplate);
                    }
                }

                if (inlineResults[0] === inlineResults[1]) {
                    sendChat(CHAT_NAME, chnTemplate);
                }
            }
        });
    };

    /**
     * Wrapper for whispering a response to the player.
     * 
     * @param {any} msg the original chat message
     * @param {any} response the response to send
     */
    const respond = (msg, response) => {
        sendChat(CHAT_NAME, "/w " + msg.who + " " + response);
    };

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

            // Validate and parse for arguments
            if (msg.selected.length > 1) {
                respond(msg, '**Please only select 1 token.**');
                return;
            }

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

            // Only allow players who control the selected character
            const char = getSelectedCharacter(msg.selected[0]);
            const controlledby = char.get('controlledby');

            if (playerIsGM(msg.playerid) || controlledby.includes(msg.playerid) || controlledby.includes('all')) {
                state.char = char;
                state.level = level;
                state.chained = chained;
                state.who = msg.who;

                sendVerification();
            } else {
                respond(msg, '**Please select a token you control.**');
            }
        } else if (msg.type === 'whisper' && msg.playerid === 'API' && msg.who === CHAT_NAME && msg.content.startsWith(VER_TEXT)) {
            castChaosBolt(msg);
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