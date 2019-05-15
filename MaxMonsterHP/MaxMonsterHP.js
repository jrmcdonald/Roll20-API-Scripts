/**
 * Roll20 API Script designed to update tokens to their maximum possible HP.
 * Compatible with the 5th Edition OGL Sheet.
 *
 * Forked from https://github.com/shdwjk/Roll20API/blob/master/MonsterHitDice/MonsterHitDice.js
 *  
 * @author Jamie McDonald - https://app.roll20.net/users/213105/fletch
 * @source https://github.com/jrmcdonald/Roll20-API-Scripts/blob/master/MaxMonsterHP/MaxMonsterHP.js
 * @version 0.0.1
 * @license MIT
 */

var MaxMonsterHP = MaxMonsterHP || (() => {
    'use strict';
    
    const VERSION = '0.0.1';
    
    const CHAT_NAME = 'MaxMonsterHP';
    const CHAT_COMMAND = '!mmhp';
    const CHAT_OPT_SEL = '--fix-selected';
    const CHAT_OPT_ALL = '--fix-all';

    const BAR = "bar1";
    
    let tokenIds = [];

    /**
     * Log script info to the console.
     */
    const checkInstall = () => {
        log('-=> MaxMonsterHP v'+VERSION+' <=-');
    };

    /**
     * Display in-game help to the chat window.
     * 
     * @returns A formatted chat template containing help information.
     */
    const displayHelp = () => {
        return '&{template:default} {{name=Max Monster HP}} {{Usage=!mmhp [options]}} {{Options=--fix-selected\n--fix-all}}';
    };

    /**
     * Parses a value into an int.
     *  
     * @param {any} val the value to parse
     * @returns The int value.
     */
    const parseValue = val => parseInt(val || "1");
    
    /**
     * Calculate the max value of a hit dice expression.
     * 
     * For example 2d6 = 12.
     *  
     * @param {any} expression the hit dice expression to calculate the maximum of
     * @returns the calculated value
     */
    const parseExpression = expression => expression.split(/d/).reduce((a,b) => parseValue(a) * parseValue(b));

    /**
     * Check if the supplied character id is an NPC or not.
     * 
     * @param {any} id the character id
     * @returns true or false
     */
    const isNpc = id => {
        let isNpc = false;
        const checkNpc = findObjs({ _type: 'attribute', _characterid: id, name: 'npc' });

        if (!_.isUndefined(checkNpc[0])) {
            if (checkNpc[0].get('current') === '1') {
                isNpc = true;
            }
        }

        return isNpc;
    };

    /**
     * Fetch the hit dice expression.
     *  
     * @param {any} obj the object to get the hit dice expression from
     * @returns the hit dice expression
     */
    const getExpression = obj => {
        let hdExpression = 0;

        const hdAttrib = findObjs({
            type: 'attribute', 
            characterid: obj.get('represents'),
            name: 'npc_hpformula'
        })[0];
        
        if (hdAttrib) {
            hdExpression = hdAttrib.get('current');
        }

        return hdExpression;
    };

    /**
     * Set the maximum hp value on a token. 
     * 
     * @param {any} obj the object to update
     */
    const setMaxHp = obj => {
        if(obj && 'graphic' === obj.get('type') 
            && 'token' === obj.get('subtype') 
            && '' !== obj.get('represents')
            && '' === obj.get('bar1_link')
            && isNpc(obj.get('represents'))) {

                let expression = getExpression(obj); 
                let hp = expression.replace(/[^+0-9d]+/g, "")
                            .split(/\+/)
                            .map(parseExpression)
                            .reduce((a, b) => parseValue(a) + parseValue(b));
                
                log(`Setting HP for ${obj.get('name')} to ${hp} (${expression}).`);                
                obj.set({bar1_value: hp || 1, bar1_max: hp || 1});
        }
    }

    /**
     * Handle the change:graphic event.
     *  
     * @param {*} obj the object being changed
     */
    const handleChangeGraphic = obj => {
        if(_.contains(tokenIds, obj.id)) {
            tokenIds = _.without(tokenIds, obj.id);
            setMaxHp(obj);
        }
    };

    /**
     * Handle the add:graphic event.
     *  
     * @param {*} obj the object being added
     */
    const handleAddGraphic = obj => {
        tokenIds.push(obj.id);

        setTimeout((function(id) {
            return function() {
                let token = getObj('graphic', id);
                if (token) {
                    handleChangeGraphic(token);
                }
            };
        }(obj.id)), 100);
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
     * Handler for chat input. Detects script triggers and checks for optional 
     * arguments.
     * 
     * @param {any} msg the chat message
     * @returns
     */    
    const handleChatMessage = msg => {
        if (msg.type === 'api' && playerIsGM(msg.playerid) && msg.content.startsWith(CHAT_COMMAND)) {
            const args = msg.content.split(' ');

            if (args.length != 2) {
                respond(msg, displayHelp());
                respond(msg, "**Please specify 1 option.");
                return;
            }
            
            if (args.includes(CHAT_OPT_SEL) && msg.selected) {
                _.each(msg.selected, selected => {
                    setMaxHp(getObj(selected._type, selected._id));
                });
                return;
            }
            
            if (args.includes(CHAT_OPT_ALL)) {
                filterObjs((o) => {
                    if ('graphic' === o.get('type') && 'token' === o.get('subtype') && '' !== o.get('represents')) {
                        setMaxHp(o);
                    }
                });
                return;
            }
        }
    };
    
    /**
     * Register event handlers
     */
    const registerEventHandlers = () => {
        on('chat:message', handleChatMessage);
        on('add:graphic', handleAddGraphic);
        on('change:graphic', handleChangeGraphic);
    };

    return {
        CheckInstall: checkInstall,
        RegisterEventHandlers: registerEventHandlers
    };
    
})();

on('ready',function() {
    'use strict';

    MaxMonsterHP.CheckInstall();
    MaxMonsterHP.RegisterEventHandlers();
});