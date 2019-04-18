/* global fh, xelib, logger, moduleUrl */

// == begin files ==
ngapp.service('prePatchService', function() {
    let service = this;

    // private
    let isNotDeleted = rec => !xelib.GetRecordFlag(rec, 'Deleted');

    // public
    this.getOverride = function() {
        return service.patchFile ?
            rec => xelib.GetPreviousOverride(rec, service.patchFile) :
            rec => xelib.GetWinningOverride(rec);
    };

    this.loadRecords = function(file, search, includeDeleted = false) {
        let records = xelib.GetRecords(file, search).map(service.getOverride());
        return includeDeleted ? records : records.filter(isNotDeleted);
    };

    this.patchFile = 0;
});

ngapp.service('skyrimEquipmentLoadService', function(gameService, skyrimMaterialService, prePatchService) {
    const itemTypeMap = {
        ARMO: 'armor',
        WEAP: 'weapon'
    };

    let {getMaterial} = skyrimMaterialService;

    // private
    let hasBodyFlag = function(rec, flag) {
        return xelib.GetFlag(rec, '[BODT|BOD2]\\General Flags', flag);
    };

    let getIsPlayable = {
        SSE: {
            WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
            ARMO: rec => !xelib.GetRecordFlag(rec, 'Non-Playable')
        },
        TES5: {
            WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
            ARMO: rec => !hasBodyFlag(rec, '(ARMO)Non-Playable')
        }
    }[gameService.appName];

    let equipmentFilter = function(sig) {
        let isAllowedType = {
            ARMO: rec => xelib.GetArmorType(rec) !== 'Clothing',
            WEAP: rec => !xelib.HasKeyword(rec, 'WeapTypeStaff') &&
                xelib.HasElement(rec, 'Model')
        }[sig];
        return rec => {
            return xelib.HasElement(rec, 'FULL') &&
                getIsPlayable[sig](rec) &&
                isAllowedType(rec) &&
                !getMaterial(rec) &&
                !xelib.HasElement(rec, 'EITM');
        };
    };

    let loadRecords = function(file, sig) {
        return prePatchService.loadRecords(file, sig)
            .filter(equipmentFilter(sig))
            .map(rec => ({
                name: xelib.FullName(rec),
                edid: xelib.EditorID(rec),
                formId: xelib.GetFormID(rec, true),
                type: itemTypeMap[sig]
            }));
    };

    let getSetName = function(fullName) {
        let match = fullName.match(/(?:(.*) War Axe|(.*) \w+)/i);
        return match && (match[1] || match[2]);
    };

    let addSet = function(sets, name) {
        let newSet = { name, armors: [], weapons: [], material: 'None' };
        sets.push(newSet);
        return newSet;
    };

    let buildSets = function(sets, file, sig, key) {
        let records = loadRecords(file, sig);
        records.forEach(record => {
            let setName = getSetName(record.name) || '~unique',
                set = sets.findByKey('name', setName) || addSet(sets, setName);
            set[key].push(record);
        });
    };

    let loadSets = function(filename) {
        let file = xelib.FileByName(filename),
            sets = [{ name: '~unique', weapons: [], armors: [] }];
        buildSets(sets, file, 'ARMO', 'armors');
        buildSets(sets, file, 'WEAP', 'weapons');
        return sets;
    };

    let pushItems = function(entry, set, key) {
        if (!set[key].length) return;
        entry.items.push(Object.assign({
            material: set.material || 'None'
        }, set[key][0]));
    };

    let handleUniqueItems = function(entry) {
        let uniqueSet = entry.sets.findByKey('name', '~unique');
        pushItems(entry, uniqueSet, 'armors');
        pushItems(entry, uniqueSet, 'weapons');
        entry.sets = entry.sets.filter(set => {
            if (set.name === '~unique') return;
            if (set.armors.length + set.weapons.length > 1) return true;
            pushItems(entry, set, 'armors');
            pushItems(entry, set, 'weapons');
        });
    };

    // public
    this.loadEquipment = function(filenames) {
        return filenames.map(filename => ({
            filename,
            sets: loadSets(filename),
            items: []
        })).filter(function(entry) {
            handleUniqueItems(entry);
            return entry.sets.length || entry.items.length;
        });
    };
});

ngapp.service('skyrimMaterialLoadService', function(prePatchService) {
    const keywordTypeMap = {
        weaponKeyword: /Weap(?:on)?Materi[ae]l/,
        armorKeyword: /Armor?Materi[ae]l/
    };

    // private
    let newMaterial = function(materials, obj) {
        materials[obj.name] = {
            filename: obj.filename,
            editorId: obj.editorId
        };
        return materials[obj.name];
    };

    let storeFormId = function(material, obj) {
        let keywordType = Object.keys(keywordTypeMap).find(key => {
            return keywordTypeMap[key].test(obj.editorId);
        }) || 'genericKeyword';
        material[keywordType] = xelib.GetHexFormID(obj.rec, true);
    };

    let loadMaterialKeywords = function(filename) {
        let file = xelib.FileByName(filename);
        return prePatchService.loadRecords(file, 'KYWD')
            .map(rec => ({ editorId: xelib.EditorID(rec), rec, filename }))
            .filter(obj => {
                let match = obj.editorId.match(/Materi[ae]l(.*)/);
                obj.name = match && match[1];
                return Boolean(match);
            });
    };

    // public
    this.loadMaterials = function(filenames) {
        return filenames.reduce((materials, filename) => {
            return materials.concat(loadMaterialKeywords(filename));
        }, []).reduce((materials, obj) => {
            let material = materials[obj.name] || newMaterial(materials, obj);
            storeFormId(material, obj);
            return materials;
        }, {});
    };
});

let settingsController = function($scope, gameService, patcherService, progressService, skyrimMaterialLoadService, skyrimEquipmentLoadService, prePatchService) {
    let {loadMaterials} = skyrimMaterialLoadService,
        {loadEquipment} = skyrimEquipmentLoadService;

    let patcherSettings = $scope.settings.skyrimMaterialPatcher,
        patcher = patcherService.getPatcher('skyrimMaterialPatcher');

    let applyOldData = function(a, item) {
        if (!a) return;
        let oldItem = a.findByKey('name', item.name);
        if (oldItem) item.material = oldItem.material || 'None';
    };

    let loadOldData = function(entry) {
        let oldEquipment = patcherSettings.equipment || [],
            oldEntry = oldEquipment.findByKey('filename', entry.filename);
        if (!oldEntry) return;
        entry.sets.forEach(set => applyOldData(oldEntry.sets, set));
        entry.items.forEach(item => applyOldData(oldEntry.items, item));
    };

    // scope functions
    $scope.load = function() {
        progressService.showProgress({ message: 'Loading materials...' });
        prePatchService.patchFile = xelib.FileByName(patcherSettings.patchFileName);
        try {
            let {filesToPatch} = patcher;
            xelib.CreateHandleGroup();
            patcherSettings.materials = loadMaterials(filesToPatch);
            progressService.progressMessage('Loading equipment...');
            let equipment = loadEquipment(filesToPatch);
            equipment.forEach(loadOldData);
            patcherSettings.equipment = equipment;
        } catch(x) {
            console.error(x);
        } finally {
            xelib.FreeHandleGroup();
            progressService.hideProgress();
        }
    };
};

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