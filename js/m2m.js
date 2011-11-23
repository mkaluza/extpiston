Ext.namespace('ExtPiston.m2m');

/* usage:
 * plugins: ['masterslave']
 *
 * and optionally:
 * masterComponent: 'path/to/component' //starting from parent
 * where empty path means direct parent
 *
 * or
 *
 * masterComponent: {path: 'path/to/component, event: 'eventname'}
 * where eventname is optional
 *
 * or
 *
 * masterComponent: {component: path.to.created.component [, event: 'eventname]}
 * where component is an object instance
 *
 * Paths are by itemId
 */

ExtPiston.MasterSlavePlugin = (function() {
	function _getByPath(obj,path) {
		if (path[0] == '..') return _getByPath(obj.ownerCt,path.slice(1));
		var newobj = obj.find('itemId',path[0])[0];	//TODO change to get (nonrecursive)
		//TODO fix it for better logic
		if (path.length == 1) {
			if (newobj) return newobj;
			if (!path[0]) return obj;		//path was empty which means the owner object itself
			//TODO raise an error
			return;
		}
		return _getByPath(newobj,path.slice(1));
	};

	function getByPath(obj,path) {
		return _getByPath(obj, path.split('/'));
	};

	function GridPanelHandler(sm,rowIndex,param3) {		//for gridpanel param3=record, for editorgridpanel param3=colindex
		var st = sm.grid.store;
		var rec = st.getAt(rowIndex);
		if (rec.phantom) return null;
		var url = st.origUrl || st.url;
		return url+'/'+rec.id;
	};

	function FormPanelHandler(form,values) {
		//TODO use getBaseUrl?
		if (!form.getPk) return null;
		var pk = form.getPk();
		if (pk == null || pk == undefined) return null;
		var url = form.origUrl || form.url;
		return url+'/'+pk;
	};

	return {
		init: function(o) {
			var obj;
			var m = o.initialConfig.masterComponent;		//TODO maybe we should assume, that if no master is given, it should always be our direct parent and only issue a warning
			if (typeof(m) == 'string') m = {path: m};		//allow master component to be given directly by name

			if (o.ownerCt instanceof Ext.FormPanel) {		//autodetect forms
				o.url = o.initialConfig.name;
				o.childUrl = o.url;
				if (!m) m = {path: ''}
				if (!m.path)					//if no path was given, assume we want parent form
					obj = o.ownerCt.form;			//we need the form, not panel, and form can't be found with 'find'
			};

			if (!m) return;		//neither we're part of a form nor master-slave relation has been defined	TODO see todo above :)

			obj = m.component || obj || getByPath(o.ownerCt,m.path);	//target object can either be given directly, implicitly (if we're form's child) or it will be searched by path
			if (!obj) throw "MaterSlavePlugin: cant find master component";

			if (!m.event) {
				if (obj instanceof Ext.grid.EditorGridPanel) m.event = 'cellselect';
				else if (obj instanceof Ext.grid.GridPanel) m.event = 'rowselect';
				else if (obj instanceof Ext.form.BasicForm) m.event = 'setvalues';
				else throw "masterComponent.event must be defined";
			};
			//else if (obj instanceof Ext.FormPanel) m.event = 'setvalues';

			if (!m.handler) {
				if (obj instanceof Ext.grid.EditorGridPanel) m.handler = GridPanelHandler;
				else if (obj instanceof Ext.grid.GridPanel) m.handler = GridPanelHandler;
				else if (obj instanceof Ext.form.BasicForm) m.handler = FormPanelHandler;
				else throw "masterComponent.handler must be defined";
			};
			//else if (obj instanceof Ext.FormPanel) m.handler = FormPanelHandler;
			//if (obj instanceof Ext.grid.GridPanel)
				if (!o.childUrl)
					console.log("childUrl for related component not set: "+o.xtype);

			obj.on(m.event, function() {
					var url = m.handler.apply(obj,arguments);		//TODO write generic handlers for different grids/forms and pass them only field name (or they can get it from store.idProperty and so on)
					if (!url) {
						this.disable();
						return;
					}
					this.enable();
					this.setBaseUrl(url);
					if (this.store && !this.store.autoLoad) this.store.load();		//not everything has a store (i.e m2mpanel)
					}, o);
			o.disable();
		}
	}
})();

Ext.preg('masterslave',ExtPiston.MasterSlavePlugin);

ExtPiston.m2m.GridPanel = Ext.extend(ExtPiston.grid.GridPanel, {
	initComponent: function () {
		/*
		 * it needs valueField, displayField, url, baseUrl
		 */

		var StoreConfig = {
			url: this.initialConfig.url || 'set_me',
			//url: '/test',
//			baseParams: {
//				{% if page_size %}limit:{{ page_size }},start: 0,{% endif %}
//			},
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
			viewConfig: {
				forceFit: true
			},
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
			height: 220,
			plugins: ['masterslave']
		}
		Ext.applyIf(this.initialConfig, config);
		Ext.apply(this,this.initialConfig);

		var grid = {
			xtype: 'extpiston.m2m.grid',
			header: true
			//border: false
		}

		this.items = [];

		var grid1 = {itemId: 'left', title: _('Not assigned')};
		var grid2 = {itemId: 'right', title: _('Assigned')};

		/*
		Ext.applyIf(grid1, this.initialConfig);
		Ext.applyIf(grid2, this.initialConfig);
		*/
		var props_to_copy = [
			'childUrl',
			'displayField',
			'name',
			'url',
			'filterBy',
			'valueField'
		];
		Ext.copyTo(grid, this.initialConfig, props_to_copy);
		grid.height = (this.initialConfig.height || config.height)-37;

		Ext.apply(grid1, grid);
		Ext.apply(grid2, grid);

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
			this.fireEvent('change');
		}, this);

		this.grid2.on('celldblclick', function(grid, rowIndex, columnIndex, e) {
			var s_st = grid.getStore();
			var rec = s_st.getAt(rowIndex);
			var d_st = this.grid1.getStore();
			d_st.add(rec);
			s_st.remove(rec);
			this.fireEvent('change');
		}, this);
		this.addEvents('change');
	}, //initComponent
	setBaseUrl: function(baseUrl) {
		this.baseUrl = baseUrl;
		var url = this.url;		//TODO this should be taken from this.initialConfig or this only ?

		this.grid1.store.proxy.setUrl(this.baseUrl+'/'+url, true);
		this.grid1.store.setBaseParam('all',1);
		this.grid1.store.load();
		this.grid2.store.proxy.setUrl(this.baseUrl+'/'+url, true);
		this.grid2.store.load();
		this.enable();
	    }
});

Ext.reg('extpiston.m2m',ExtPiston.m2m.Panel);
