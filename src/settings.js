let settingsController = function($scope, gameService, patcherService, recordPatchingService, skyrimMaterialService) {
    let getIsPlayable = {
        SSE: {
            WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
            ARMO: rec => !xelib.GetRecordFlag(rec, 'Non-Playable')
        },
        TES5: {
            WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
            ARMO: rec => !xelib.GetFlag(rec, 'ACBS\\General Flags', '(ARMO)Non-Playable')
        }
    }[gameService.appName];

    let {getMaterial} = skyrimMaterialService,
        patcherSettings = $scope.settings.skyrimMaterialPatcher,
        patcher = patcherService.getPatcher('skyrimMaterialPatcher'),
        patchFile = xelib.FileByName(patcherSettings.patchFileName);

    let recordFilter = {
        WEAP: function(rec) {
            return !xelib.GetRecordFlag(rec, 'Deleted') &&
                xelib.HasElement(rec, 'FULL') &&
                getIsPlayable.WEAP(rec) &&
                !getMaterial(rec) &&
                !xelib.HasElement(rec, 'EITM');
        },
        ARMO: function(rec) {
            return !xelib.GetRecordFlag(rec, 'Deleted') &&
                xelib.HasElement(rec, 'FULL') &&
                getIsPlayable.ARMO(rec) &&
                !getMaterial(rec) &&
                !xelib.HasElement(rec, 'EITM');
        }
    };

    // helper functions
    let buildRecordData = (rec) => ({
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
            .filter(recordFilter[sig])
            .map(buildRecordData);
    };

    let getSetName = function(record) {
        let fullName = xelib.FullName(record),
            match = fullName.match(/.* (\w+)/i);
        return match && match[1];
    };

    let getSet = function(sets, name) {
        return sets.find(set => set.name === name);
    };

    let addSet = function(sets, name) {
        let newSet = { name, items: [] };
        sets.push(newSet);
        return newSet;
    };

    let loadSets = function(filename) {
        let file = xelib.FileByName(filename),
            armors = loadRecords(file, 'ARMO'),
            weapons = loadRecords(file, 'WEAP'),
            records = armors.concat(weapons);
        return records.reduce((sets, record) => {
            let setName = getSetName(record),
                set = getSet(sets, setName) || addSet(sets, setName);
            set.items.push(record);
            return sets;
        });
    };

    let loadOldData = function(entry) {
        let oldEntry = patcherSettings.files.find(file => {
            return file.filename === entry.filename;
        });
        if (!oldEntry) return;
        entry.sets.forEach(set => {
            let oldSet = oldEntry.sets.find(oldSet => {
                return oldSet.name === set.name;
            });
            set.material = (oldSet && oldSet.material) || 'None';
        });
    };

    let buildFileObject = filename => ({
        filename,
        sets: loadSets(filename)
    });

    let loadFiles = function() {
        let files = patcher.filesToPatch
            .map(buildFileObject)
            .filter(entry => entry.sets.length);
        files.forEach(loadOldData);
        return files;
    };

    let loadMaterialKeywords = function(filename) {
        let file = xelib.FileByName(filename);
        return xelib.GetRecords(file, 'KYWD')
            .map(getOverride())
            .filter(rec => !xelib.GetRecordFlag(rec, 'Deleted'))
            .map(rec => ({ editorId: xelib.EditorId(rec), rec }))
            .filter(obj => {
                let match = obj.editorId.match(/Materi[ae]l(.*)/);
                if (!match) return;
                obj.name = match[1];
                obj.filename = filename;
                obj.fid = xelib.GetFormId(obj.rec, true);
                delete obj.rec;
                return true;
            });
    };

    let loadMaterials = function() {
        return patcher.filesToPatch.reduce((materials, filename) => {
            return materials.concat(loadMaterialKeywords(filename));
        }, []);
    };

    // scope functions
    $scope.load = function() {
        xelib.WithHandleGroup(() => {
            patcherSettings.materials = loadMaterials();
            patcherSettings.files = loadFiles();
        });
    };
};