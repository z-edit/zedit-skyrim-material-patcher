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
