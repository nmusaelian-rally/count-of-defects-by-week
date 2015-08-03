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
        this.getDates();
        this.createFilters();
        this.makeStore();
        
    },
    getDates:function(){
        var now = new Date(),
            today = now.getDay(),
            friday = 5,
            howFarBack = this.numberOfWeeks + 1,
            fridayDates = [],
            weeks = [],
            closestFriday = null,
            prevFriday = null;
        var daysFromLastFriday = today - friday;
        closestFriday = new Date(now - daysFromLastFriday*86400000)
        fridayDates.push(Rally.util.DateTime.format(closestFriday, 'Y-m-d'));
        console.log('today:', today, 'daysFromLastFriday:',daysFromLastFriday, 'closestFriday:',closestFriday);
        //today: 6 daysFromLastFriday: 1 closestFriday: Fri Jul 31 2015 10:21:01 GMT-0600 (MDT)
        for(var i=1;i<howFarBack;i++){
            var prevFriday = new Date(closestFriday - 7*86400000);
            fridayDates.push(Rally.util.DateTime.format(prevFriday, 'Y-m-d'));
            closestFriday = prevFriday;
             
        }
        console.log('fridayDates:',fridayDates);
        for (var i=0; i<fridayDates.length-1; i++) {
            var week = {};
            week['end'] = fridayDates[i];
            week['start'] = fridayDates[i+1];
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
        adminResolutionFilter = Rally.data.wsapi.Filter.or([
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
                    operator : '>',
                    value : week['start']
                },
                {
                    property : 'CreationDate',
                    operator : '<=',
                    value : week['end']
                }
            ]);
            
            var closedDateFilter = Rally.data.wsapi.Filter.and([
                {
                    property : 'ClosedDate',
                    operator : '>',
                    value : week['start']
                },
                {
                    property : 'ClosedDate',
                    operator : '<=',
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
            limit: Infinity,
        });
        this.applyFiltersToStore(0);
    },
    applyFiltersToStore:function(i){
        this.defectStore.addFilter(this.concatArrayOfFilters[i]);
        this.defectStore.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    console.log('records.length',records.length);
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
                        console.log('eightWeeksData',this.eightWeeksData);
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
            console.log(record.get('FormattedID'));
            console.log('created',created);
            console.log('closed',closed);
            var diff = Math.floor((closed - created)/86400000); 
            console.log('diff', diff);
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
            
        console.log('chunksOfData', chunksOfData);
        var zippedChunks = _.zip(chunksOfData);
        console.log('zippedChunks',zippedChunks);
        
        
        for(var i = 0;i<zippedChunks.length;i++){
            console.log('i:',i);
            var o = {};
            for(var j=0; j<zippedChunks[i].length;j++){
                o[j] = zippedChunks[i][j];
            }
            arrayOfObjects.push(o);
        }
        
        console.log('arrayOfObjects', arrayOfObjects);
        
       
    }
});
        


