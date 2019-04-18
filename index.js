/* global fh, xelib, logger, moduleUrl */

// == begin files ==
//= require src/prePatchService.js
//= require src/skyrimEquipmentLoadService.js
//= require src/skyrimMaterialLoadService.js
//= require src/settings.js
// == end files ==

let skyrimMaterialPatcher = function(patchFile, helpers, settings) {
    let {logMessage, cacheRecord} = helpers,
        dummyKeywords = {};

    let injectKeywords = function() {
        logMessage('Injecting keywords');
        let group = xelib.AddElement(patchFile, 'KYWD');
        Object.keys(settings.materials).forEach(name => {
            let editorId = `SMP_Material${name}`;
            logMessage(`Creating keyword ${editorId}`);
            let rec = xelib.AddElement(group, 'KYWD');
            xelib.AddElement(rec, 'EDID');
            cacheRecord(rec, editorId);
            dummyKeywords[name] = xelib.GetHexFormID(rec, true);
        });
    };

    let addMaterialKeyword = function(patchRec, set, type) {
        let keywordValue = set.useDummyKeyword ?
            dummyKeywords[set.material] :
            settings.materials[set.material][`${type}Keyword`] ||
            settings.materials[set.material].genericKeyword;
        if (!keywordValue) return;
        xelib.AddKeyword(patchRec, keywordValue);
    };

    let addPatchRecord = function(file, formId) {
        let rec = xelib.GetRecord(file, formId);
        rec = xelib.GetPreviousOverride(rec, patchFile);
        return helpers.copyToPatch(rec);
    };

    let patchItemSet = function(set, file) {
        if (set.material === 'None') return;
        let patchKeyword = function(item) {
            let patchRec = addPatchRecord(file, item.formId);
            addMaterialKeyword(patchRec, set, item.type);
        };

        set.weapons.forEach(patchKeyword);
        set.armors.forEach(patchKeyword);
    };

    let patchItem = function(item, file) {
        if (item.material === 'None') return;
        let patchRec = addPatchRecord(file, item.formId);
        addMaterialKeyword(patchRec, item, item.type);
    };

    let materialAssigned = entry => entry.material !== 'None';

    let patchItemKeywords = function(entry) {
        let file = xelib.FileByName(entry.filename),
            setsToPatch = entry.sets.filter(materialAssigned),
            itemsToPatch = entry.items.filter(materialAssigned),
            numSets = setsToPatch.length,
            numItems = itemsToPatch.length;
        logMessage(`Patching ${numSets} sets from ${entry.filename}`);
        setsToPatch.forEach(set => patchItemSet(set, file));
        logMessage(`Patching ${numItems} items from ${entry.filename}`);
        itemsToPatch.forEach(item => patchItem(item, file));
    };

    return {
        initialize: function() {
            injectKeywords();
            settings.equipment.forEach(patchItemKeywords);
        },
        process: []
    }
};

ngapp.run(function(patcherService) {
    patcherService.registerPatcher({
        info: info,
        gameModes: [xelib.gmSSE, xelib.gmTES5],
        settings: {
            label: 'Skyrim Material Patcher',
            templateUrl: `${moduleUrl}/partials/settings.html`,
            controller: settingsController,
            defaultSettings: {}
        },
        execute: skyrimMaterialPatcher
    });
});