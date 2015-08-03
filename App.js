Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    weeks : [],
    eightWeeksData : [],
    arrayOfCreationDateFilters : [],
    arrayOfFixedFilters : [],
    arrayOfAdminClosedFilters : [],
    launch: function() {
        this.getDates();
        this.createFilters();    
    },
    getDates:function(){
        var now = new Date(),
            today = now.getDay(),
            friday = 5,
            howFarBack = 9,
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
        //console.log(weeks);
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
        //console.log(fixedFilter.toString());
        //console.log(adminClosedFilter.toString());
        
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
    }
});
        


