/* global fh, xelib, logger, registerPatcher, patcherPath, patcherUrl */

//
//= require src/settings.js
//

let dummyKeywords;

let injectKeywords = function(patchFile, helpers, settings) {
    helpers.logMessage('Injecting keywords');
    let group = xelib.AddElement(patchFile, 'KYWD');
    settings.materials.forEach(material => {
        helpers.logMessage(`Creating keyword ${material.editorId}`);
        let rec = xelib.AddElement(group, 'KYWD');
        helpers.cacheRecord(rec, `SMP_Material${material.name}`);
        dummyKeywords[material.name] = xelib.GetHexFormID(rec, true);
    });
};

let addMaterialKeyword = function(patchRec, settings, set, type) {
    let keywordValue = set.useDummyKeyword ?
        dummyKeywords[set.material] :
        settings.materials[set.material][`${type}Keyword`] ||
        settings.materials[set.material].genericKeyword;
    if (!keywordValue) return;
    xelib.AddKeyword(patchRec, keywordValue);
};

let patchItemSet = function(set, file, helpers, settings) {
    if (set.material === 'None') return;
    let patchKeyword = function(item, type) {
        let rec = xelib.GetRecord(file, item.fid),
            patchRec = helpers.copyToPatch(rec);
        addMaterialKeyword(patchRec, settings, set, type);
    };

    set.weapons.forEach(item => patchKeyword(item, 'weapon'));
    set.armors.forEach(item => patchKeyword(item, 'armor'));
};

let patchItemKeywords = function(helpers, settings) {
    settings.equipment.forEach(entry => {
        let file = xelib.FileByName(entry.filename),
            setsToPatch = entry.sets.filter(set => set.material !== 'None'),
            numSets = setsToPatch.length;
        helpers.logMessage(`Patching ${numSets} sets from ${entry.filename}`);
        setsToPatch.forEach(set => patchItemSet(set, file, helpers, settings));
    });
};

registerPatcher({
    info: info,
    gameModes: [xelib.gmSSE, xelib.gmTES5],
    settings: {
        label: 'Skyrim Material Patcher',
        templateUrl: `${patcherUrl}/partials/settings.html`,
        controller: settingsController,
        defaultSettings: {}
    },
    execute: (patchFile, helpers, settings) => ({
        initialize: function() {
            dummyKeywords = {};
            injectKeywords(patchFile, helpers, settings);
            patchItemKeywords(helpers, settings);
        }
    })
});