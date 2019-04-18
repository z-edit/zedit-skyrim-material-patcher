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
