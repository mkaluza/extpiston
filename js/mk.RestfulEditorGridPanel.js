/*
 * $ Revision: $
 * Grid współpracujący domyślnie z pistonowym webservice'em (subklasą Ext*)
 */

Ext.ns('mk');

mk.RestfulEditorGridPanel = Ext.extend(Ext.grid.EditorGridPanel, {
	initComponent: function() {
		var onSave = function onSave(btn, ev) {
			//TODO
			this.store.save();
		}

		var onAdd = function onAdd(btn, ev) {
			//TODO
			var rec = {}
			for(var i=0; i<this.store.fields.keys.length; i++) {
				var f = this.store.fields.keys[i];
				if (f != this.store.reader.meta.idProperty) rec[f]='';
			}
			var u = new this.store.recordType(rec);	//nie trzeba, ale wtedy cały się podświetla i jest wyraźniej
			u.markDirty();
			this.stopEditing();
			this.store.insert(0, u);
			this.startEditing(0,1);	//TODO - to sie musi samo wymyslac albo znajdywac
		}

		var onDelete = function onDelete() {
			var sm = this.getSelectionModel();
			var rec = sm.getSelectedCell();
			if (!rec) {
				return false;
			}
			this.store.removeAt(rec[0]);
			var cnt = this.store.getCount();
			if (cnt<=rec[0]) sm.select(cnt-1,1);
			else sm.select(rec[0],1)
		}
		
		var proxyConfig = {		
			url: this.initialConfig.url,
		};
		if (this.initialConfig.proxyConfig) proxyConfig = Ext.apply(proxyConfig,this.initialConfig.proxyConfig);

		var proxy = new Ext.data.HttpProxy(proxyConfig); //proxy

		if (this.initialConfig.remoteFilter) 
			proxy.remoteFilter = this.initialConfig.remoteFilter;

		proxy.addListener('beforeload', function(proxy,params) {
			if (this.remoteFilter)
				params = Ext.apply(params,this.remoteFilter);
		});

		var writer = new Ext.data.JsonWriter({
			encode: true,  //false // <-- don't return encoded JSON -- causes Ext.Ajax#request to send data using jsonData config rather than HTTP params
			writeAllFields: true
		}); //writer
		
		var fields=[];
		var fieldParams=['allowBlank', 'type', 'dateFormat'];

		for(var i=0;i< this.initialConfig.columns.length;i++) {
			var c=this.initialConfig.columns[i];
			var f={name: c.dataIndex};
			for(var fp=0;fp<fieldParams.length;fp++) {
				var name=fieldParams[fp];
				if (!(c[name]===undefined) ) f[name]=c[name];
			}
			fields.push(f)
		};
		var reader = new Ext.data.JsonReader({
			totalProperty: 'total',
			successProperty: 'success',
			idProperty: 'id',	//TODO - uzywac initialConfig
			messageProperty: 'message',
			root: 'data'
			}, fields
		);

		var storeConfig = {
			restful: true,	 // <-- This Store is RESTful
			autoLoad: true,
			proxy: proxy,
			reader: reader,
			autoSave: false,
			sortInfo: this.initialConfig.sortInfo,
			writer: writer,	// <-- plug a DataWriter into the store just as you would a Reader
		}; //storeConfig
		if (this.initialConfig.grouping) {
			var grouping=this.initialConfig.grouping;
			if (grouping.groupField) storeConfig.groupField=grouping.groupField;
			var store = new Ext.data.GroupingStore(storeConfig);
		} else var store = new Ext.data.Store(storeConfig);

		var buttons = {
			add: {
				text: 'Dodaj',
				handler: onAdd.createDelegate(this)
			},
			remove:  {
				text: 'Usuń',
				handler: onDelete.createDelegate(this)
			}, 
			save: {
				text: 'Zapisz',
				handler: onSave.createDelegate(this)
			}
		};

		var config = {
			store: store,
			clicksToEdit: 1,	//wazne!!!
			tbar: [],
			viewConfig: {
				forceFit: true
			}
		}; //config
		//TODO to jest do przerobiuenia
		if (this.initialConfig.viewConfig) config.viewConfig= Ext.apply(config.viewConfig,this.initialConfig.viewConfig);
		
		if (this.initialConfig.grouping) {
			config.view = new Ext.grid.GroupingView(config.viewConfig);
		};
//		else{
//			config.viewConfig ={forceFit: true};
//		}

		if (!this.initialConfig.RESTbuttons) this.initialConfig.RESTbuttons=['add','remove','save'];
		
		for (var n=0;n<this.initialConfig.RESTbuttons.length;n++) {
			config.tbar.push(buttons[this.initialConfig.RESTbuttons[n]]);
			if (n<this.initialConfig.RESTbuttons.length-1) config.tbar.push('-');
		}
		
		Ext.apply(this, Ext.apply(this.initialConfig, config));

		mk.RestfulEditorGridPanel.superclass.initComponent.apply(this, arguments);
	}, //initComponent
	remoteFilter: function(filter) {
		this.proxy.remoteFilter = filter;
	}
}); //Ext.extend

Ext.reg('restfuleditorgridpanel',mk.RestfulEditorGridPanel);
