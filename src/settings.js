let settingsController = function($scope, gameService, patcherService, progressService, skyrimMaterialService) {
    const keywordTypeMap = {
        weaponKeyword: /Weap(?:on)?Materi[ae]l/,
        armorKeyword: /Armor?Materi[ae]l/
    };

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

    let {getMaterial} = skyrimMaterialService,
        patcherSettings = $scope.settings.skyrimMaterialPatcher,
        patcher = patcherService.getPatcher('skyrimMaterialPatcher'),
        patchFile = xelib.FileByName(patcherSettings.patchFileName);

    let equipmentFilter = function(sig) {
        let isAllowedType = {
            ARMO: rec => xelib.GetArmorType(rec) !== 'Clothing',
            WEAP: rec => !xelib.HasKeyword(rec, 'WeapTypeStaff') &&
                xelib.HasElement(rec, 'Model')
        }[sig];
        return rec => {
            return !xelib.GetRecordFlag(rec, 'Deleted') &&
                xelib.HasElement(rec, 'FULL') &&
                getIsPlayable[sig](rec) &&
                isAllowedType(rec) &&
                !getMaterial(rec) &&
                !xelib.HasElement(rec, 'EITM');
        };
    };

    // helper functions
    let buildRecordData = rec => ({
        name: xelib.FullName(rec),
        edid: xelib.EditorID(rec)
    });

    let getOverride = function() {
        return patchFile ?
            rec => xelib.GetPreviousOverride(patchFile, rec) :
            rec => xelib.GetWinningOverride(rec);
    };

    let loadRecords = function(file, sig) {
        return xelib.GetRecords(file, sig)
            .map(getOverride())
            .filter(equipmentFilter(sig))
            .map(buildRecordData);
    };

    let getSetName = function(fullName) {
        let match = fullName.match(/(?:(.*) War Axe|(.*) \w+)/i);
        return match && (match[1] || match[2]);
    };

    let getSet = function(sets, name) {
        return sets.find(set => set.name === name);
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
                set = getSet(sets, setName) || addSet(sets, setName);
            set[key].push(record);
        });
    };

    let loadSets = function(filename) {
        let file = xelib.FileByName(filename),
            sets = [];
        buildSets(sets, file, 'ARMO', 'armors');
        buildSets(sets, file, 'WEAP', 'weapons');
        return sets;
    };

    let handleUniqueItems = function(entry) {
        let uniqueSet = entry.sets.findByKey('name', '~unique') || {};
        entry.items = Array.prototype.concat(
            uniqueSet.armors || [], uniqueSet.weapons || []
        );
        entry.items.forEach(item => item.material = 'None');
        entry.sets = entry.sets.filter(set => {
            if (set.name === '~unique') return;
            if (set.armors.length + set.weapons.length > 1) return true;
            ['armors', 'weapons'].forEach(key => {
                if (!set[key].length) return;
                entry.items.push(Object.assign({
                    material: set.material || 'None'
                }, set[key][0]));
            });
        });
    };

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

    let loadEquipment = function() {
        let equipment = patcher.filesToPatch
            .map(filename => ({ filename, sets: loadSets(filename) }))
            .filter(entry => entry.sets.length);
        equipment.forEach(handleUniqueItems);
        equipment.forEach(loadOldData);
        return equipment;
    };

    let newMaterial = function(materials, obj) {
        return materials[obj.name] = {
            filename: obj.filename,
            editorId: obj.editorId
        };
    };

    let storeFormId = function(material, obj) {
        let keywordType = Object.keys(keywordTypeMap).find(key => {
            return keywordTypeMap[key].test(obj.editorId);
        }) || 'genericKeyword';
        material[keywordType] = xelib.GetHexFormID(obj.rec, true);
    };

    let loadMaterialKeywords = function(filename) {
        let file = xelib.FileByName(filename);
        return xelib.GetRecords(file, 'KYWD')
            .map(getOverride())
            .filter(rec => !xelib.GetRecordFlag(rec, 'Deleted'))
            .map(rec => ({ editorId: xelib.EditorID(rec), rec, filename }))
            .filter(obj => {
                let match = obj.editorId.match(/Materi[ae]l(.*)/);
                obj.name = match && match[1];
                return Boolean(match);
            });
    };

    let loadMaterials = function() {
        return patcher.filesToPatch.reduce((materials, filename) => {
            return materials.concat(loadMaterialKeywords(filename));
        }, []).reduce((materials, obj) => {
            let material = materials[obj.name] || newMaterial(materials, obj);
            storeFormId(material, obj);
            return materials;
        }, {});
    };

    // scope functions
    $scope.load = function() {
        progressService.showProgress({ message: 'Loading materials...' });
        try {
            xelib.WithHandleGroup(() => {
                patcherSettings.materials = loadMaterials();
                progressService.progressMessage('Loading equipment...');
                patcherSettings.equipment = loadEquipment();
            });
            progressService.hideProgress();
        } catch(x) {
            progressService.hideProgress();
            console.error(x);
        }
    };
};