/* global fh, xelib, registerPatcher, patcherPath, patcherUrl */

//= require src/settings.js

let sortedGroups = {};
let keywords;

let loadKeywords = function(key) {
    let filePath = fh.path(patcherPath, 'resources', `${key}Keywords.json`);
    keywords = fh.loadResourceFile(filePath);
};

let injectKeywords = function(patchFile, helpers) {
    helpers.logMessage('Injecting keywords');
    let group = xelib.AddElement(patchFile, 'KYWD');
    keywords.forEach(({editorId, formId}) => {
        helpers.logMessage(`Injecting keyword ${editorId} into Skyrim.esm with form ID: ${formId}`);
        let rec = xelib.AddElement(group, 'KYWD');
        xelib.SetValue(rec, 'EDID', editorId);
        xelib.SetFormID(rec, formId);
    });
};

let getSortedGroup = function(filename, sig) {
    let key = `${filename}/${sig}`;
    if (!sortedGroups.hasOwnProperty(key)) {
        let file = xelib.FileByName(filename);
        xelib.SortEditorIDs(file, sig);
        sortedGroups[key] = xelib.GetElement(file, sig);
    }
    return sortedGroups[key];
};

let getKeywordToUse = function(sig, material) {
    return keywords.find(keyword => {
        return keyword.sig === sig && keyword.material === material;
    })
};

let patchKeywords = function(patchFile, helpers, settings, sig, label) {
    let {setMaterialKeyword} = helpers.skyrimMaterialService,
        items = settings[sig];
    helpers.logMessage(`Patching ${items.length} ${label} records`);
    items.forEach(item => {
        if (records.hasOwnProperty(item.edid)) return;
        let group = getSortedGroup(item.filename, sig),
            rec = xelib.GetElement(group, item.edid),
            keyword = getKeywordToUse(item.material),
            patchRec = helpers.copyToPatch(rec, false);
        setMaterialKeyword(patchRec, keyword);
    });
};

registerPatcher({
    info: info,
    gameModes: [xelib.gmSSE, xelib.gmTES5],
    settings: {
        label: 'Skyrim Keyword Fixes',
        templateUrl: `${patcherUrl}/partials/settings.html`,
        controller: settingsController,
        defaultSettings: {}
    },
    execute: (patchFile, helpers, settings) => ({
        initialize: function() {
            sortedGroups = {};
            loadKeywords(settings.keywordSet);
            injectKeywords(patchFile, helpers);
            patchKeywords(patchFile, helpers, settings, 'ARMO', 'armor');
            patchKeywords(patchFile, helpers, settings, 'WEAP', 'weapon');
        }
    })
});