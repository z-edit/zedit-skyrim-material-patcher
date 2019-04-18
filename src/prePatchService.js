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
