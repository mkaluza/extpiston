{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.gridColumns = {{ gridColumns }}
{{app_label|title}}.{{name}}.gridColumnNames = {{ gridColumnNames }}

{{app_label|title}}.{{name}}.gridInit = function() {
		{% if separate_store %}
		{% include "mksoftware/store.js.tpl" with store_type="json" %}
		{% endif %}
		var config = {
			store: {{name}}StoreConfig,
			autoHeight: true,
			columns: [],
			loadMask: true,
			{% if page_size %}
			autoScroll: false,
			bbar: {
				xtype:'paging',
				pageSize: {{ page_size }},
				displayInfo: true,
				displayMsg: 'Wyniki {0} - {1} z {2}',
				emptyMsg: "Brak wyników"
			},
			{% endif %}
			{% if verbose_name %}title: '{{verbose_name}}',{% endif %}
			viewConfig: {
				emptyText: 'Brak wyników',
				//autoFill: true		//fits columns only on render
				forceFit: true			//fits columns always - on resize as well
			},
			itemId: '{{ name|lower }}'
		}; //config
		for (var name in {{app_label|title}}.{{name}}.gridColumnNames) {
			name = {{app_label|title}}.{{name}}.gridColumnNames[name]
			if (typeof(name)=='string') config.columns.push({{app_label|title}}.{{name}}.gridColumns[name]);
		}

		if (this.initialConfig.storeConfig)
			Ext.apply(config.store,this.initialConfig.storeConfig);	//apply extra configuration for the store

		if (!(this.initialConfig.store))
			config.store = new Ext.data.JsonStore(config.store); 		//if no store is supplied, create one from config

		this.setBaseUrl = function(baseUrl) {
			//TODO zrobić to lepiej... dużo lepiej...
			var url = baseUrl+'/{{ name|lower }}';
			//this.store.url = url;		//optional for unified look
			this.store.proxy.setUrl(url,true);
		}

		if (this.initialConfig.baseUrl) {				//if a component handles a related field, baseUrl is added to url
			var baseUrl = this.initialConfig.baseUrl;
			if (typeof(baseUrl) == "string")
				this.setBaseUrl(baseUrl);
			//TODO to zrobić jako eventy, bo jak jest funkcja, to znaczy, że ma być dynamiczne
			//else if (typeof(baseUrl) == "function")
			//	config.store.url = baseUrl()+'/'+config.store.url
			//	else
			//		throw "{{app_label|title}}.{{name}}.gridInit: invalid baseUrl: "+baseUrl;
		}
		//dynamic base url setting
		var thisGrid = this;
		var setDynamicBaseUrl = function(store) {
			//if it's a function, call it to get current base url
			if (typeof(thisGrid.initialConfig.baseUrl) == "function") thisGrid.store.proxy.setUrl(thisGrid.initialConfig.baseUrl()+'/{{ name|lower }}');
		}
		config.store.on('beforeload',setDynamicBaseUrl);
		config.store.on('beforesave',setDynamicBaseUrl);
		config.store.on('beforewrite',setDynamicBaseUrl); //is this necessary?

		Ext.applyIf(this.initialConfig, config);

		if (this.initialConfig.filterBy) {
			this.initialConfig.tbar = this.initialConfig.tbar || [];
			var tb = this.initialConfig.tbar;
			tb.push(new Ext.ux.form.SearchField({paramName: 'filter__'+this.initialConfig.filterBy, store: this.initialConfig.store}));
		}

		if (this.initialConfig.bbar) 		//if has a bbar
			if (!this.initialConfig.bbar.store) 	//that doesnt have a store yet
				this.initialConfig.bbar.store = this.initialConfig.store;	//than set it

		Ext.apply(this, this.initialConfig);
}

{{app_label|title}}.{{name}}.gridPostInit = function() {
	this.relayEvents(this.getStore(),['load','save']);
	this.getStore().enableBubble(['load','save']);
}

{{app_label|title}}.{{name}}.GridPanel = Ext.extend(Ext.grid.GridPanel, {
	initComponent:function() {
		{{app_label|title}}.{{name}}.gridInit.apply(this,arguments);
		{{app_label|title}}.{{name}}.GridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange','rowselect']);

		{{app_label|title}}.{{name}}.gridPostInit.apply(this,arguments);
	} //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.grid',{{app_label|title}}.{{name}}.GridPanel);

{{app_label|title}}.{{name}}.EditorGridPanel = Ext.extend(Ext.grid.EditorGridPanel, {
	initComponent:function() {
		var storeConfig = {
		};
		if (this.initialConfig.storeConfig)
			Ext.applyIf(this.initialConfig.storeConfig, storeConfig);
		else
			this.initialConfig.storeConfig = storeConfig;

		{{app_label|title}}.{{name}}.gridInit.apply(this,arguments);

		var onSave = function onSave(btn, ev) {
			this.getStore().save();
		}

		var onAdd = function onAdd(btn, ev) {
			//TODO
			var rec = {};
			var store = this.getStore();
			for(var i=0; i<store.fields.keys.length; i++) {
				var f = store.fields.keys[i];
				if (f != store.reader.meta.idProperty) rec[f]='';
			}
			var u = new store.recordType(rec);	//nie trzeba, ale wtedy cały się podświetla i jest wyraźniej
			u.markDirty();
			this.stopEditing();
			store.insert(0, u);
			this.startEditing(0,1);	//TODO - to sie musi samo wymyslac albo znajdywac
			this.fireEvent('addItem', this, u);
		}

		var onDelete = function onDelete() {
			var sm = this.getSelectionModel();
			var rec = sm.getSelectedCell();
			var store = this.getStore();
			if (!rec) {
				return false;
			}
			store.removeAt(rec[0]);
			var cnt = store.getCount();
			if (cnt<=rec[0]) sm.select(cnt-1,1);
			else sm.select(rec[0],1);
			this.fireEvent('removeItem', this, rec);
		}

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

		//TODO zrobić to mądrzej
		if (!this.initialConfig.tbar) {
			this.initialConfig.tbar = [];
		}
		else this.initialConfig.tbar.unshift('-');

		var tbar = this.initialConfig.tbar;
		if (!this.initialConfig.RESTbuttons) this.initialConfig.RESTbuttons=['add','remove','save'];

		for (var n = this.initialConfig.RESTbuttons.length-1;n>=0; n--) {
			tbar.unshift(buttons[this.initialConfig.RESTbuttons[n]]);
			if (n>0) tbar.unshift('-');
		}
		/*for (var n=0;n<this.initialConfig.RESTbuttons.length;n++) {
			tbar.push(buttons[this.initialConfig.RESTbuttons[n]]);
			if (n<this.initialConfig.RESTbuttons.length-1) tbar.push('-');
		}*/
		Ext.apply(this, this.initialConfig);

		for(var n = 0; n < this.columns.length; n++)
		{
			var col = this.columns[n]
			if (col.editable) {
			       if (!col.editor) col.editor = {{app_label|title}}.{{name}}.{{name2|title}}formFields[col.name];
			       if (!(col.editor.xtype in Ext.ComponentMgr.types)) console.log('type ' +col.editor.xtype+ ' not available');
			       if (col.fk && !col.renderer) col.renderer = fkrenderer;
			}
		}
		{{app_label|title}}.{{name}}.EditorGridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange']);
		this.addEvents(['addItem','removeItem']);

		{{app_label|title}}.{{name}}.gridPostInit.apply(this,arguments);
	} //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.editorgrid',{{app_label|title}}.{{name}}.EditorGridPanel);
