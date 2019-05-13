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

var MaxMonsterHP = MaxMonsterHP || (function() {
    'use strict';
    
    const VERSION = '0.0.1';
    
    const CHAT_NAME = 'MaxMonsterHP';
    const CHAT_COMMAND = '!mmhp';

    const CHAT_OPT_SEL = '--fix-selected';
    const CHAT_OPT_ALL = '--fix-all';
    
    let tokenIds = [];

    const checkInstall = function() {
        log('-=> MaxMonsterHP v'+VERSION+' <=-');
    };

    const handleInput = function(msg) {
        var args;

        if (msg.type !== "api") {
            return;
        }

        args = msg.content.split(/\s+/);
        switch(args[0]) {
            case '!mmh':
                break;
        }
    };

    const parseValue = function(val) {
        return parseInt(val || "1");
    };
    
    const parseExpression = function(expression) {
        log("Parsing " + expression);
      
        var parts = expression.split(/d/);
        var sum = 0;
        var limit = parseValue(parts[1]);
        
        for (var i = parseValue(parts[0]) - 1; i >= 0; i--) {
            sum += limit;      
        }
        
        return sum;
    };

    const setMaxHP = function(obj) {
        var sets = {},
            bar = 'bar1',
            hdAttrib,
            hdExpression = 0,
            hp = 0
            ;

        if(_.contains(tokenIds, obj.id)) {
            tokenIds=_.without(tokenIds,obj.id);

            if('graphic' === obj.get('type') && 'token' === obj.get('subtype') && '' !== obj.get('represents')) {
                
                if(obj && '' === obj.get(bar+'_link')) {
                    hdAttrib = findObjs({
                        type: 'attribute', 
                        characterid: obj.get('represents'),
                        name: npc_hpformula
                    })[0];
                    
                    if (hdAttrib) {
                        hdExpression = hdAttrib.get('current');
                        
                        hp = hdExpression.replace(/[^+0-9d]+/g, "")
                                         .split(/\+/)
                                         .map(parseExpression)
                                         .reduce(function(a,b){return a + b;});
                        
                        sets[bar+"_value"] = hp||1;
                        sets[bar+"_max"] = hp||1;
                        obj.set(sets);
                    }
                }
            }
        }
    };

    const saveTokenId = function(obj){
        tokenIds.push(obj.id);

        setTimeout((function(id){
            return function(){
                var token=getObj('graphic',id);
                if(token){
                    setMaxHP(token);
                }
            };
        }(obj.id)),100);
    };

    const registerEventHandlers = function() {
        on('chat:message', handleInput);
        on('add:graphic', saveTokenId);
        on('change:graphic', setMaxHP);
    };

    return {
        CheckInstall: checkInstall,
        RegisterEventHandlers: registerEventHandlers
    };
    
}());

on('ready',function() {
    'use strict';

    MaxMonsterHP.CheckInstall();
    MaxMonsterHP.RegisterEventHandlers();
});