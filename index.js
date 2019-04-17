/* global fh, xelib, logger, registerPatcher, patcherPath, patcherUrl */

// == begin files ==
//= require src/prePatchService.js
//= require src/skyrimEquipmentLoadService.js
//= require src/skyrimMaterialLoadService.js
//= require src/settings.js
// == end files ==

let dummyKeywords;

let injectKeywords = function(patchFile, helpers, settings) {
    helpers.logMessage('Injecting keywords');
    let group = xelib.AddElement(patchFile, 'KYWD');
    Object.keys(settings.materials).forEach(name => {
        let material = settings.materials[name];
        helpers.logMessage(`Creating keyword ${material.editorId}`);
        let rec = xelib.AddElement(group, 'KYWD');
        helpers.cacheRecord(rec, `SMP_Material${name}`);
        dummyKeywords[name] = xelib.GetHexFormID(rec, true);
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
    let patchKeyword = function(item) {
        let rec = xelib.GetRecord(file, item.fid),
            patchRec = helpers.copyToPatch(rec);
        addMaterialKeyword(patchRec, settings, set, item.type);
    };

    set.weapons.forEach(patchKeyword);
    set.armors.forEach(patchKeyword);
};

let patchItem = function(item, file, helpers, settings) {
    if (item.material === 'None') return;
    let rec = xelib.GetRecord(file, item.fid),
        patchRec = helpers.copyToPatch(rec);
    addMaterialKeyword(patchRec, settings, item, item.type);
};

let patchItemKeywords = function(helpers, settings) {
    settings.equipment.forEach(entry => {
        let file = xelib.FileByName(entry.filename),
            setsToPatch = entry.sets.filter(set => set.material !== 'None'),
            itemsToPatch = entry.items.filter(item => item.material !== 'None'),
            numSets = setsToPatch.length;
        helpers.logMessage(`Patching ${numSets} sets from ${entry.filename}`);
        setsToPatch.forEach(set => patchItemSet(set, file, helpers, settings));
        itemsToPatch.forEach(item => patchItem(item, file, helpers, settings));
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
        },
        process: []
    })
});