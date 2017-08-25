/**
 * Roll20 API Script designed to dynamically generate a token action macros. 
 * Compatible with the 5th Edition OGL Sheet.
 *  
 * @author Fletch - https://app.roll20.net/users/213105/fletch
 * @version 0.0.1
 * @license MIT
 */

var TokenAction = (() => {
  'use strict';

  const VERSION = '0.2.1.2';

  const CHAT_NAME = 'TokenAction';
  const CHAT_COMMANDS = { CREATE: '!ta', DELETE: '!deleteta' };
  const PATTERNS = {
    NPC_ACTION: /repeating_npcaction_[^_]+_name\b/,
    NPC_ACTION_L: /repeating_npcaction-l_[^_]+_name\b/,
    NPC_SPELL: /repeating_spell-npc_[^_]+_spellname\b/,
    PLAYER_ATK: /repeating_attack_[^_]+_atkname\b/,
    REPEAT_ID: /%%RID%%/g
  }

  let fxMap = new Map();

  /**
   * Displays the script version information to the API console.
   */
  const displayInfo = () => {
    log('TokenAction v' + VERSION + ' loaded!');
  };

  /**
   * Find the supplied action name in the fx map. Iterates over the map
   * and check's using includes as for NPC spells I include the spell
   * level in the name, so an exact match isn't always possible. 
   * 
   * @param {any} fxName the action name to find in the fx map
   * @returns the /fx command 
   */
  const getFx = (fxName) => {
    let fx;

    for (let [k, v] of fxMap) {
      if (fxName.includes(k)) {
        fx = v;
      }
    }

    return fx;
  };

  /**
   * Get the characters for the supplied array of tokens. 
   * 
   * @param {any} selected the selected tokens
   * @returns an array of characters
   */
  const getSelectedCharacters = (selected) => {
    return _.chain(selected)
      .map(function (s) {
        return getObj(s._type, s._id);
      })
      .reject(_.isUndefined)
      .map(function (c) {
        return getObj('character', c.get('represents'));
      })
      .filter(_.identity)
      .value();
  };

  /**
   * Create a token action ability on the specified character id. If a
   * matching ability name already exists then update it.
   * 
   * @param {any} name the name of the ability to create/update
   * @param {any} action the action for the ability
   * @param {any} id the character id
   */
  const createAbility = (name, action, id) => {
    const checkAbility = findObjs({ _type: 'ability', _characterid: id, name: name });

    if (checkAbility[0]) {
      checkAbility[0].set({ action: action });
    } else {
      createObj('ability', { name: name, action: action, characterid: id, istokenaction: true });
    }
  };

  /**
   * Create the ability action for a repeating action that matches the specified name pattern.
   * 
   * @param {any} name the name pattern to match against
   * @param {any} pattern the pattern to output in the macro
   * @param {any} id the character id
   */
  const createRepeating = (name, pattern, id) => {
    const repeatingAttrs = filterObjs(o => o.get('type') === 'attribute' && o.get('characterid') === id && o.get('name').match(name));

    _.each(repeatingAttrs, (attr) => {
      const repeatingId = attr.get('name').split('_')[2];
      const repeatingName = attr.get('current');
      let repeatingAction = "%{selected|" + (pattern.replace(PATTERNS.REPEAT_ID, repeatingId)) + "}";
      const checkAbility = findObjs({ _type: 'ability', _characterid: id, name: repeatingName });

      // Apply /fx commands if they exist
      const fx = getFx(repeatingName);
      if (!_.isUndefined(fx)) {
        repeatingAction += "\n" + fx;
      }

      createAbility(repeatingName, repeatingAction, id);
    });
  };

  /**
   * Check if the supplied character id is an NPC or not.
   * 
   * @param {any} id the character id
   * @returns true or false
   */
  const isNpc = (id) => {
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
   * Delete all the abilities of a specified character id
   * 
   * @param {any} id the character id
   */
  const deleteAbilities = (id) => {
    let abilities = findObjs({ _type: 'ability', _characterid: id });
    _.each(abilities, r => r.remove());
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
   * Check for the presence of any of the supported chat commands
   * 
   * @param {any} content the message content
   * @returns true or false
   */
  const checkForCommands = (content) => {
    let commandPresent = false;

    _.each(CHAT_COMMANDS, (command) => {
      if (content.startsWith(command)) {
        commandPresent = true;
      }
    });

    return commandPresent;
  };

  /**
   * Handler for chat input.
   * 
   * @param {any} msg the chat message
   * @returns
   */
  const handleInput = (msg) => {
    if (msg.type === 'api' && checkForCommands(msg.content) && msg.selected) {
      const char = _.uniq(getSelectedCharacters(msg.selected));

      _.each(char, (char) => {
        const controlledby = char.get('controlledby');

        if (playerIsGM(msg.playerid) || controlledby.includes(msg.playerid) || controlledby.includes('all')) {
          if (msg.content.startsWith(CHAT_COMMANDS.CREATE)) {
            if (isNpc(char.id)) {
              createRepeating(PATTERNS.NPC_ACTION, 'repeating_npcaction_%%RID%%_npc_action', char.id);
              createRepeating(PATTERNS.NPC_ACTION_L, 'repeating_npcaction-l_%%RID%%_npc_action', char.id);
              createRepeating(PATTERNS.NPC_SPELL, 'repeating_spell-npc_%%RID%%_spell', char.id);
            } else {
              createAbility('0 Init', "%{selected|initiative}", char.id);
              createAbility('0 Checks', "/w \"@{character_name}\" &{template:default} {{name=Ability Checks}} {{Strength=[Strength](~selected|Strength)}} {{Dexterity=[Dexterity](~selected|Dexterity)}} {{Constitution=[Constitution](~selected|Constitution)}} {{Intelligence=[Intelligence](~selected|Intelligence)}} {{Wisdom=[Wisdom](~selected|Wisdom)}} {{Charisma=[Charisma](~selected|Charisma)}}", char.id);
              createAbility('0 Saves', "/w \"@{character_name}\" &{template:default} {{name=Saving Throws}} {{Strength=[Strength](~selected|Strength_Save)}} {{Dexterity=[Dexterity](~selected|Dexterity_Save)}} {{Constitution=[Constitution](~selected|Constitution_Save)}} {{Intelligence=[Intelligence](~selected|Intelligence_Save)}} {{Wisdom=[Wisdom](~selected|Wisdom_Save)}} {{Charisma=[Charisma](~selected|Charisma_Save)}}", char.id);
              createAbility('0 Skills', "/w \"@{character_name}\" &{template:default} {{name=Skill Checks}} {{Strength=[Athletics](~selected|Athletics)}} {{Dexterity=[Acrobatics](~selected|Acrobatics)[Sleight of Hand](~selected|Sleight_of_Hand)[Stealth](~selected|Stealth)}} {{Intelligence=[Arcana](~selected|Arcana)[History](~selected|History)[Investigation](~selected|Investigation)[Nature](~selected|Nature)[Religion](~selected|Religion)}} {{Wisdom=[Animal Handling](~selected|Animal_Handling)[Insight](~selected|Insight)[Medicine](~selected|Medicine)[Perception](~selected|Perception)[Survival](~selected|Survival)}} {{Charisma=[Deception](~selected|Deception)[Intimidation](~selected|Intimidation)[Performance](~selected|Performance)[Persuasion](~selected|Persuasion)}}", char.id);
              createAbility('0 Spells', "!dsb --prepared-only --apply-fx", char.id);
              createRepeating(PATTERNS.PLAYER_ATK, 'repeating_attack_%%RID%%_attack', char.id);
            }
            respond(msg, "Created Token Actions for " + char.get('name') + ".");
          }
        } else if (msg.content.startsWith(CHAT_COMMANDS.DELETE)) {
          deleteAbilities(char.id);
          respond(msg, "Deleted Token Actions for " + char.get('name') + ".");
        }
      });
    }
    return;
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
    log('TokenAction: Registered ' + fx.size + ' fx commands.');
    fxMap = fx;
  };

  return {
    displayInfo,
    registerHandlers,
    registerFx
  };
})();

on('ready', function () {
  'use strict';

  TokenAction.displayInfo();
  TokenAction.registerHandlers();
});