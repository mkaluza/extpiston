Ext.namespace('ExtPiston.m2m');


ExtPiston.m2m.GridPanel = Ext.extend(Ext.grid.GridPanel, {
	initComponent: function () {
		/*
		 * it needs valueField, displayField, url, baseUrl
		 */

		var StoreConfig = {
			url: this.initialConfig.url || 'set_me',
			//url: '/test',
			baseParams: {
//				{% if page_size %}limit:{{ page_size }},start: 0,{% endif %}
			},
			method: 'GET',
			root: 'data',
			fields: [ this.initialConfig.valueField || 'id', this.initialConfig.displayField || '__str__'],
			writer: new Ext.data.JsonWriter({encode:true}),
			autoSave: true,
			idProperty: this.initialConfig.valueField || 'id',
			restful: true
		};
		var store = new Ext.data.JsonStore(StoreConfig);

		this.initialConfig.columns = [
			{hidden: true, header: 'ID', hideable: false, dataIndex: this.initialConfig.valueField || 'id'},
			{header: '&#160;', dataIndex: this.initialConfig.displayField || '__str__'}
		];

		var config = {
			forceFit: true,
			enableHdMenu: false,
			hideHeaders: true,
			store: store
		};

		if (this.initialConfig.baseUrl) {				//if a component handles a related field, baseUrl is added to url
			var baseUrl = this.initialConfig.baseUrl;
			if (typeof(baseUrl) == "string")
				this.setBaseUrl(baseUrl);
		}
		//dynamic base url setting
		var setDynamicBaseUrl = function(store) {
			//if it's a function, call it to get current base url
			if (typeof(this.baseUrl) == "function") this.store.proxy.setUrl(this.initialConfig.baseUrl()+'/'+this.url);
		}
		config.store.on('beforeload', setDynamicBaseUrl, this);
		config.store.on('beforesave', setDynamicBaseUrl, this);
		config.store.on('beforewrite', setDynamicBaseUrl, this); //is this necessary?

		Ext.applyIf(this.initialConfig, config);
		Ext.apply(this,this.initialConfig);

		ExtPiston.m2m.GridPanel.superclass.initComponent.apply(this, arguments);

	}, //initComponent
	setBaseUrl: function(baseUrl) {
		//TODO zrobić to lepiej... dużo lepiej...
		var url = baseUrl+this.url;
		this.baseUrl = baseUrl;
		this.store.url = url;		//optional for unified look
		this.store.proxy.setUrl(url,true);
	}
});

Ext.reg('extpiston.m2m.grid',ExtPiston.m2m.GridPanel);

//TODO many of this code is common with ExtPiston.grid... do something about it...
ExtPiston.m2m.Panel = Ext.extend(Ext.Panel, {
	initComponent: function () {
		var config = {
			valueField: 'id',
			displayField: '__str__',
			baseUrl: '',	//url part that comes from parent component like /name/pk_value/ - may be a function to set it dynamically
			url: this.initialConfig.name || '',	//url that will be added to baseUrl and set as url of the grids
			layout: 'column',
			defaults: {columnWidth: 0.5},
			height: 200
		}
		Ext.applyIf(this.initialConfig, config);
		Ext.apply(this,this.initialConfig);

		var grid = {
			xtype: 'extpiston.m2m.grid',
			title: undefined
		}

		this.items = [];

		var grid1 = {itemId: 'left'};
		var grid2 = {itemId: 'right'};

		Ext.apply(grid1, grid, this.initialConfig);
		Ext.apply(grid2, grid, this.initialConfig);

		this.items.push(grid1);
		this.items.push(grid2);

		ExtPiston.m2m.Panel.superclass.initComponent.apply(this, arguments);

		this.grid1 = this.find('itemId','left')[0];
		this.grid2 = this.find('itemId','right')[0];

		this.grid1.on('celldblclick', function(grid, rowIndex, columnIndex, e) {
			var s_st = grid.getStore();
			var rec = s_st.getAt(rowIndex);
			var d_st = this.grid2.getStore();
			rec.phantom = true;
			s_st.remove(rec);
			d_st.add(rec);
			if (!d_st.autoSave) d_st.save();
		}, this);

		this.grid2.on('celldblclick', function(grid, rowIndex, columnIndex, e) {
			var s_st = grid.getStore();
			var rec = s_st.getAt(rowIndex);
			var d_st = this.grid1.getStore();
			d_st.add(rec);
			s_st.remove(rec);
		}, this);

		//TODO look for parent form
		if (this.ownerCt.form)
			this.ownerCt.form.on('setvalues', function(form,values) {
				var pk = form.getPk();
				this.setBaseUrl(form.url+'/'+pk);
			});

		//TODO move these functions somewhere, so they are more 'common'
		function _getByPath(obj,path) {
			if (path[0] == '..') return getByPath(obj.ownerCt,path.slice(1));
			obj = obj.find('itemId',path[0])[0];
			if (path.length == 1) return obj;
			return getByPath(obj,a.slice(1));
		}

		function getByPath(obj,path) {
			return _getByPath(obj, path.split('/'));
		}

		if (this.initialConfig.masterComponent) {
			var m = this.initialConfig.masterComponent;
			var obj = getByPath(this.ownerCt,m.path);
			obj.on(m.event, function() {
					var url = m.handler.apply(obj,arguments);
					this.setBaseUrl(url);
					}, this);
		}
	}, //initComponent
	setBaseUrl: function(baseUrl) {
		this.baseUrl = baseUrl;
		var url = this.initialConfig.url;		//TODO this should be taken from this.initialConfig or this only ?

		this.grid1.store.proxy.setUrl(this.baseUrl+'/'+url, true);
		this.grid1.store.setBaseParam('all',1);
		this.grid1.store.load();
		this.grid2.store.proxy.setUrl(this.baseUrl+'/'+url, true);
		this.grid2.store.load();
	    }
});

Ext.reg('extpiston.m2m',ExtPiston.m2m.Panel);
