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
		//this.store.url = url;		//optional for unified look
		this.store.proxy.setUrl(url,true);
	}
});

Ext.reg('extpiston.m2m.grid',ExtPiston.m2m.GridPanel);

ExtPiston.m2m.Panel = Ext.extend(Ext.Panel, {
	initComponent: function () {
		var config = {
			valueField: 'id',
			displayField: '__str__',
			baseUrl: '',	//url part that comes from parent component like /name/pk_value/ - may be a function to set it dynamically
			url: '',	//url that will be added to baseUrl and set as url of the grids
			layout: 'column',
			defaults: {columnWidth: 0.5},
			height: 200
		}
		Ext.applyIf(this.initialConfig, config);
		Ext.apply(this,this.initialConfig);

		var grid = {
			xtype: 'extpiston.m2m.grid'
		}

		this.items = [];

		var grid1 = {itemId: 'left'};
		var grid2 = {itemId: 'right'};
		
		Ext.apply(grid1, grid, this.initialConfig);
		Ext.apply(grid2, grid, this.initialConfig);
		
		this.items.push(grid1);
		this.items.push(grid2);

		ExtPiston.m2m.Panel.superclass.initComponent.apply(this, arguments);

		var grid1 = this.find('itemId','left')[0];
		var grid2 = this.find('itemId','right')[0];

		grid1.on('celldblclick', function(grid, rowIndex, columnIndex, e) {
			var rec = grid.getStore().getAt(rowIndex);
			var st = grid2.getStore();
			rec.phantom = true;
			st.add(rec);
			st.save();
		});

		grid2.on('celldblclick', function(grid, rowIndex, columnIndex, e) {
			var rec = grid.getStore().getAt(rowIndex);
			var st = grid1.getStore();
			st.add(rec);
		});
		var name = this.initialConfig.name;
		this.ownerCt.form.on('setvalues', function(form,values) {
			var pk = form.getPk();
			this.baseUrl = form.url+'/'+pk;
			grid1.store.proxy.setUrl(this.baseUrl+'/'+name, true);
			grid1.store.setBaseParam('all',1);
			grid1.store.load();
			grid2.store.proxy.setUrl(this.baseUrl+'/'+name, true);
			grid2.store.load();
		});

	} //initComponent
});

Ext.reg('extpiston.m2m',ExtPiston.m2m.Panel);
