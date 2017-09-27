/**
 * Roll20 API Script designed to dynamically generate a clickable listing
 * of a character's spells. Compatible with the 5th Edition OGL Sheet.
 *  
 * @author Fletch - https://app.roll20.net/users/213105/fletch
 * @version 0.0.1
 * @license MIT
 */

var DynamicSpellbook = (() => {
  'use strict';

  const VERSION = '0.0.1';

  const CHAT_NAME = 'Dynamic Spellbook';
  const CHAT_COMMAND = '!dsb';

  const CHAT_OPT_HELP = '--help';
  const CHAT_OPT_PREP = '--prepared-only';
  const CHAT_OPT_LEVEL = '--filter-by-level';
  const CHAT_OPT_FX = '--apply-fx';

  const PATTERN_LEVEL_FILTER = /^[0-9,]+$/;
  const PATTERN_REPEATING_SPELL = /repeating_spell-\S+_[^_]+_spellname\b/;

  let fxMap = new Map();

  /**
   * Displays the script version information to the API console.
   */
  const displayInfo = () => {
    log(CHAT_NAME + ' v' + VERSION + ' loaded.')
  };

  /**
   * Display in-game help to the chat window.
   * 
   * @returns A formatted chat template containing help information.
   */
  const displayHelp = () => {
    return '&{template:default} {{name=Dynamic Spellbook}} {{Usage=!dsb [options]}} {{Options=--prepared-only\n--filter-by-level 0,1,2,...9\n--apply-fx}}';
  };

  /**
   * Fetch the character object for the selected token. 
   * 
   * @param {any} selected the selected token
   * @returns the character object
   */
  const getSelectedCharacter = selected => getObj('character', getObj(selected._type, selected._id).get('represents'));

  /**
   * Create the dynamic spellbook template to send to the chat window. For the
   * selected spells, it builds a map of API Command Buttons which are then
   * joined together into the final output template.
   * 
   * Performs filtering of the spell listing according to supplied arguments.
   * 
   * @param {any} id the selected character id
   * @param {any} preparedOnly whether to select only prepared spells or not
   * @param {any} levelFilter an array of spell levels to include
   * @param {any} applyFx whether to apply fx commands or not
   * @returns the template to output to the chat window
   */
  const createSpellbook = (id, preparedOnly, levelFilter, applyFx) => {
    const spellbook = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '8': [], '9': [] };

    filterObjs((o) => {
      if (o.get('type') === 'attribute' && o.get('characterid') === id && o.get('name').match(PATTERN_REPEATING_SPELL)) {
        const attr = o.get('name');
        const attrPrefix = attr.substring(0, attr.lastIndexOf("_"));

        const name = o.get('current');
        let level = attr.split('_')[1].replace('spell-', '').replace('cantrip', 0);

        // Determine whether to filter out the spell or not
        let includeSpell = true;

        if (level.startsWith('{{')) {
          // Added after OGL sheet 2.0 and spell conversion process.
          return;
        }
      
        let preparedVal = getAttrByName(id, attrPrefix + '_prep');
        
        if (typeof preparedVal == 'undefined') {
            preparedVal = getAttrByName(id, attrPrefix + '_spellprepared');
        }
      
        if (level != 0 && preparedOnly && parseInt(preparedVal, 10) !== 1) {
          includeSpell = false;
        }
  
        if (!_.isEmpty(levelFilter) && !levelFilter.includes(level)) {
          includeSpell = false;
        }

        if (includeSpell) {
          let spellAction = '%{selected|' + attrPrefix + '_spell}';

          if (applyFx) {
            const fx = fxMap.get(name);

            if (!_.isUndefined(fx)) {
              spellAction += "\n" + fx;
            }
          }

          const checkSpell = findObjs({ _type: 'ability', _characterid: id, name: name });

          if (checkSpell[0]) {
            checkSpell[0].set({ action: spellAction });
          } else {
            createObj("ability", { name: name, action: spellAction, characterid: id, istokenaction: false });
          }

          spellbook[level].push('[' + name + '](!&#13;&#37;{selected|' + name + '})');
        }
      }
      return;
    });

    // Build up the template string
    let templates = [];

    _.mapObject(spellbook, (spells, level) => {
      if (!_.isEmpty(spells)) {
        templates.push(" {{Level " + level + "=" + spells.join('') + "}}");
      }
    });

    return templates.length > 0 ? '&{template:default} {{name=Spells}}' + templates.join() : '**No spells found matching your criteria.**';
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
   * arguments. Responds with the generated spellbook template.
   * 
   * @param {any} msg the chat message
   * @returns
   */
  const handleInput = (msg) => {
    if (msg.type === 'api' && msg.content.startsWith(CHAT_COMMAND) && msg.selected) {
      let applyFx = false;
      let preparedOnly = false;
      let levelFilter = [];

      const args = msg.content.split(' ');

      // Validate and parse for optional arguments
      if (msg.selected.length > 1) {
        respond(msg, '**Please only select 1 token.**');
        return;
      }
      
      if (args.includes(CHAT_OPT_HELP)) {
        respond(msg, displayHelp());
        return;
      }

      if (args.includes(CHAT_OPT_PREP)) {
        preparedOnly = true;
      }

      if (args.includes(CHAT_OPT_LEVEL)) {
        const levels = args[args.indexOf(CHAT_OPT_LEVEL) + 1];
        if (PATTERN_LEVEL_FILTER.test(levels)) {
          levelFilter = levels.split(',');
        }
      }

      if (args.includes(CHAT_OPT_FX)) {
        applyFx = true;
      }

      // Only allow players who control the selected character
      const char = getSelectedCharacter(msg.selected[0]);
      const controlledby = char.get('controlledby');

      if (playerIsGM(msg.playerid) || controlledby.includes(msg.playerid) || controlledby.includes('all')) {
        respond(msg, createSpellbook(char.id, preparedOnly, levelFilter, applyFx));
      } else {
        respond(msg, '**Please select a token you control.**');
      }
    }
  };

  /**
   * Register event handlers
   */
  const registerHandlers = () => {
    on('chat:message', handleInput);
  };

  /**
   * Store the supplied map of fx commands in the internal fx map;
   * 
   * @param {any} fx a map of action name -> /fx commands
   */
  const registerFx = (fx) => {
    log('DynamicSpellbook: Registered ' + fx.size + ' fx commands.');
    fxMap = fx;
  };

  return {
    displayInfo,
    registerHandlers,
    registerFx
  };
})();

on('ready', () => {
  'use strict';

  DynamicSpellbook.displayInfo();
  DynamicSpellbook.registerHandlers();
});