Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    numberOfWeeks : 8,
    weeks : [],
    createdDefects:[],
    eightWeeksData : [],
    eightWeeksTTRData : [],
    arrayOfCreationDateFilters : [],
    arrayOfFixedFilters : [],
    arrayOfAdminClosedFilters : [],
    defectStore : null,
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long..."});
        this._myMask.show();
        this.getDates();
        this.createFilters();
        this.makeStore();
        
    },
    getDates:function(){
        var now = new Date(),
            today = now.getDay(),
            saturday = 6,
            howFarBack = this.numberOfWeeks + 1,
            saturdayDates = [],
            weeks = [],
            closestSaturday = null,
            prevSaturday = null;
        var daysFromLastSaturday = today - saturday;
        closestSaturday = new Date(now - daysFromLastSaturday*86400000);
        saturdayDates.push(Rally.util.DateTime.format(closestSaturday, 'Y-m-d'));
        console.log('today:', today, 'daysFromLastSaturday:',daysFromLastSaturday, 'closestSaturday:',closestSaturday);
        for(var i=1;i<howFarBack;i++){
            var prevSaturday = new Date(closestSaturday - 7*86400000);
            saturdayDates.push(Rally.util.DateTime.format(prevSaturday, 'Y-m-d'));
            closestSaturday = prevSaturday;
             
        }
        console.log('saturdayDates:',saturdayDates);
        for (var i=0; i<saturdayDates.length-1; i++) {
            var week = {};
            week['end'] = saturdayDates[i];
            week['start'] = saturdayDates[i+1];
            this.weeks.push(week);
        }
    },
    createFilters:function(){
        console.log(this.weeks);
        var tagFilter;
        var codeResolitionFilter;
        var adminResolutionFilter;
        var closedFilter;
        var fixedFilter;
        var adminClosedFilter;
        var closedDateFilters = [];
        var creationDateFilters = [];
        
        tagFilter = Ext.create('Rally.data.wsapi.Filter', {
             property : 'Tags.Name',
             operator: 'contains',
             value: 'Customer Voice'
        });
        
        closedFilter = tagFilter.and(Ext.create('Rally.data.wsapi.Filter', {
            property : 'State',
	    value: 'Closed'
        }));
        
        codeResolitionFilter = Rally.data.wsapi.Filter.or([
            {
		property : 'Resolution',
		value : 'Code Change'
	    },
	    {
		property : 'Resolution',
		value : 'Database/Metadata Change'
	    },
	    {
		property : 'Resolution',
		value: 'Configuration Change'
	    }
        ]);
        adminResolutionFilter = Rally.data.wsapi.Filter.and([
            {
		property : 'Resolution',
                operator: '!=',
		value : 'Code Change'
	    },
	    {
		property : 'Resolution',
                operator: '!=',
		value : 'Database/Metadata Change'
	    },
	    {
		property : 'Resolution',
                operator: '!=',
		value: 'Configuration Change'
	    }
        ]);
        fixedFilter = closedFilter.and(codeResolitionFilter);
        adminClosedFilter = closedFilter.and(adminResolutionFilter);
        
        _.each(this.weeks, function(week){
            var creationDateFilter = Rally.data.wsapi.Filter.and([
                {
                    property : 'CreationDate',
                    operator : '>=',
                    value : week['start']
                },
                {
                    property : 'CreationDate',
                    operator : '<',
                    value : week['end']
                }
            ]);
            
            var closedDateFilter = Rally.data.wsapi.Filter.and([
                {
                    property : 'ClosedDate',
                    operator : '>=',
                    value : week['start']
                },
                {
                    property : 'ClosedDate',
                    operator : '<',
                    value : week['end']
                }
            ]);
            
            this.arrayOfCreationDateFilters.push(tagFilter.and(creationDateFilter));
            this.arrayOfFixedFilters.push(fixedFilter.and(closedDateFilter));
            this.arrayOfAdminClosedFilters.push(adminClosedFilter.and(closedDateFilter));
        },this);
        
        
        console.log('-----CreationDate Filters-----');
        _.each(this.arrayOfCreationDateFilters, function(filter){
            console.log(filter.toString());
        },this);
        console.log('-----Fixed Filters-----');
        _.each(this.arrayOfFixedFilters, function(filter){
            console.log(filter.toString());
        },this);
        console.log('-----Admin Closed Filters-----');
        _.each(this.arrayOfAdminClosedFilters, function(filter){
            console.log(filter.toString());
        },this);
        
    },
    makeStore:function(){
        this.concatArrayOfFilters = this.arrayOfCreationDateFilters.concat(
            this.arrayOfFixedFilters,this.arrayOfAdminClosedFilters);
        this.defectStore = Ext.create('Rally.data.wsapi.Store',{
            model: 'Defect',
            fetch: ['Name','State','FormattedID','CreationDate','ClosedDate'],
            limit: Infinity
        });
        this.applyFiltersToStore(0);
    },
    applyFiltersToStore:function(i){
        this.defectStore.addFilter(this.concatArrayOfFilters[i]);
        this.defectStore.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    //console.log('records.length',records.length);
                    this.eightWeeksData.push(records.length);
                    if (i>=this.numberOfWeeks) {
                        this.eightWeeksTTRData.push(this.getClosedDefectsWithinTTR(records));
                    }
                    this.defectStore.clearFilter(records.length);
                    if (i < this.concatArrayOfFilters.length-1) {
                        this.applyFiltersToStore(i + 1);
                    }
                    else{
                        this.eightWeeksData = this.eightWeeksData.concat(this.eightWeeksTTRData);
                        //console.log('eightWeeksData',this.eightWeeksData);
                        this.makeCustomStore();
                    }
                }
            }
        });
    },
    getClosedDefectsWithinTTR:function(records){
        var ttr = 20;
        var closedDefectWithinTTRCount = [];
        var arrayOfDataObjects = [];
        _.each(records, function(record){
            var created = new Date(record.get('CreationDate'));
            var closed = new Date(record.get('ClosedDate'));
            //console.log(record.get('FormattedID'));
            //console.log('created',created);
            //console.log('closed',closed);
            var diff = Math.floor((closed - created)/86400000); 
            //console.log('diff', diff);
            if (diff <= ttr) {
                closedDefectWithinTTRCount.push(record);
            }
        },this);
        return closedDefectWithinTTRCount.length;
    },
    makeCustomStore:function(){
        var arrayOfObjects = [];
        var chunksOfData = [];
        var i,j,k,chunk = this.numberOfWeeks;
            for (i=0,j=this.eightWeeksData.length,k=0; i<j; i+=chunk,k++) {
                chunksOfData[k] = this.eightWeeksData.slice(i,i+chunk);
            }
            
        var zippedChunks = _.zip(chunksOfData);
        console.log('zippedChunks',zippedChunks);
        
        
        for(var i = 0;i<zippedChunks.length;i++){
            var o = {};
            for(var j=0; j<zippedChunks[i].length;j++){
                o[j] = zippedChunks[i][j];
            }
            arrayOfObjects.push(o);
        }
        console.log('arrayOfObjects', arrayOfObjects);
        this.makeGrid(arrayOfObjects);
    },
    makeGrid:function(data){
        this._myMask.hide();
        var mergedData = _.merge(data, this.weeks);
        console.log('mergedData',mergedData);
        
        this._grid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'defectGrid',
            store: Ext.create('Rally.data.custom.Store', {
                data: data
            }),
            columnCfgs: [
                {
                    text: 'Start Week',
                    dataIndex: 'start'
                },
                {
                    text: 'End Week',
                    dataIndex: 'end'
                },
                {
                    text: 'Created Defects',
                    dataIndex: '0'
                },
                {
                    text: 'Fixed Defect',
                    dataIndex: '1'
                },
                {
                    text: 'Administratively Closed Defects',
                    dataIndex: '2'
                },
                {
                    text: 'Fixed Defect (TTR <= 20)',
                    dataIndex: '3'
                },
                {
                    text: 'Administratively Closed Defects (TTR <= 20)',
                    dataIndex: '4'
                }
            ],
            showPagingToolbar:false
        });
        this.add(this._grid);
    }
});
        


