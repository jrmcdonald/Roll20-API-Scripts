on('ready', () => {
  'use strict';

  const fxMap = new Map();
  fxMap.set("Burning Hands", "/fx hands @{selected|token_id} @{target|Target|token_id}");
  fxMap.set("Ice Knife", "/fx knife @{selected|token_id} @{target|Target|token_id}");
  fxMap.set("Inflict Wounds", "/fx splatter-death @{selected|token_id} @{target|Target|token_id}");
  fxMap.set("Magic Missile", "/fx missile-magic @{target|Target 1|token_id}\n/fx missile-magic @{target|Target 2|token_id}\n/fx missile-magic @{target|Target 3|token_id}");
  fxMap.set("Sacred Flame", "/fx burn-holy @{target|Target|token_id}");
  fxMap.set("Shocking Grasp", "/fx grasp @{target|Target|token_id}");
  fxMap.set("Thorn Whip", "/fx thorn @{selected|token_id} @{target|Target|token_id}");
  fxMap.set("Thunderwave", "/fx nova-smoke @{selected|token_id}");

  if (!_.isUndefined(DynamicSpellbook)) {
    DynamicSpellbook.registerFx(fxMap);
  }

  if (!_.isUndefined(TokenAction)) {
    TokenAction.registerFx(fxMap);
  }
});