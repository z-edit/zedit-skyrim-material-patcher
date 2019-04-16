let settingsController = function($scope, gameService, patcherService, recordPatchingService, skyrimMaterialService) {
    const signatures = ['ARMO', 'WEAP'];

    let getIsPlayable = {
        SSE: {
            WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
            ARMO: rec => !xelib.GetRecordFlag(rec, 'Non-Playable')
        },
        TES5: {
            WEAP: rec => !xelib.GetFlag(rec, 'DNAM\\Flags', 'Non-playable'),
            ARMO: rec => !xelib.GetFlag(rec, 'ACBS\\General Flags', '(ARMO)Non-Playable')
        }
    };

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
        data.material = (oldData && oldData.material) || 'None';
        return data;
    };

    let buildRecordData = (rec, sig) => loadRecordData({
        filename: getFileName(rec),
        name: xelib.FullName(rec),
        edid: xelib.EditorID(rec)
    }, rec, sig);

    let hasMaterial = rec => Boolean(getMaterial(rec));

    let loadData = function(sig) {
        let isPlayable = getIsPlayable[gameService.appName][sig],
            records = loadRecords(patchFile, patcher.filesToPatch, sig);
        return records.filter(rec => isPlayable(rec) && !hasMaterial(rec))
            .map(rec => buildRecordData(rec, sig));
    };

    // scope functions
    $scope.load = function() {
        xelib.WithHandleGroup(() => {
            signatures.forEach(sig => patcherSettings[sig] = loadData(sig));
        });
    };
};