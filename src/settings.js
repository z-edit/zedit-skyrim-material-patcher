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
