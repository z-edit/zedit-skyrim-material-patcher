let isPlayable = {
    SSE: {
        WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
        ARMO: rec => !xelib.GetRecordFlag(rec, 'Non-Playable')
    },
    TES5: {
        WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
        ARMO: rec => !xelib.GetFlag(rec, 'ACBS\\General Flags', '(ARMO)Non-Playable')
    }
};

let settingsController = function($scope, gameService, patcherService, recordPatchingService, skyrimMaterialService) {
    const signatures = ['ARMO', 'WEAP'];

    let {loadRecords} = recordPatchingService,
        {getMaterial} = skyrimMaterialService,
        patcherSettings = $scope.settings.skyrimKeywordFixes,
        patcher = patcherService.getPatcher('skyrimKeywordFixes'),
        patchFile = xelib.FileByName(patcherSettings.patchFileName);

    // helper functions
    let getFileName = rec => xelib.Name(xelib.GetElementFile(rec));

    let loadRecordData = function(data, rec, sig) {
        if (!patcherSettings[sig]) return;
        let oldData = patcherSettings[sig].findByKey('edid', data.edid);
        data.material = (oldData && oldData.material) || getMaterial(rec);
        return data;
    };

    let buildRecordData = (rec, sig) => loadRecordData({
        filename: getFileName(rec),
        name: xelib.FullName(rec),
        edid: xelib.EditorID(rec)
    }, rec, sig);

    let loadData = function(sig) {
        let records = loadRecords(patchFile, patcher.filesToPatch, sig);
        return records.filter(isPlayable[gameService.appName][sig])
            .map(rec => buildRecordData(rec, sig));
    };

    // scope functions
    $scope.load = function() {
        xelib.WithHandleGroup(() => {
            signatures.forEach(sig => patcherSettings[sig] = loadData(sig));
        });
    };
};