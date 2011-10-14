{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.gridColumns = {{ gridColumns }};
{{app_label|title}}.{{name}}.gridColumnNames = {{ gridColumnNames }};

{{app_label|title}}.{{name}}.gridInit = function() {
		{% if separate_store %}
		{% include "mksoftware/store.js.tpl" with store_type="json" nocreate=1 %}
		delete {{name}}StoreConfig['storeId'];
		var store = {{name}}StoreConfig;
		{% else %}
		var store = {{name}}Store;
		{% endif %}
		var config = {
			store: store,
			autoHeight: true,
			//columns: [],
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
			tools: [{
				id: 'refresh',
				handler: function(event, toolEl, panel, tc) {
					panel.store.reload();
				}
			       }],
			itemId: '{{ name|lower }}',
			singleSelect: true,
			childUrl: '{{ name|lower }}'		//URL part, that is appended to baseUrl, when the component is a child component
		}; //config

		if (this.initialConfig.storeConfig)
			Ext.apply(config.store,this.initialConfig.storeConfig);	//apply extra configuration for the store

		if (this.initialConfig.viewConfig)
			Ext.applyIf(this.initialConfig.viewConfig, config.viewConfig);	//apply default configuration for view

		//TODO fix this for shared store
		if (!(this.initialConfig.store))
			config.store = new Ext.data.JsonStore(config.store); 		//if no store is supplied, create one from config

		config.store.on('save', function() {
				var st = Ext.StoreMgr.get('{{name}}Store');
				if (st) st.load();
				});		//reload global store when data change

		config.store.on('beforeload', this.setDynamicBaseUrl, this);
		config.store.on('beforesave', this.setDynamicBaseUrl, this);
		config.store.on('beforewrite', this.setDynamicBaseUrl, this); //is this necessary?

		Ext.applyIf(this.initialConfig, config);		//shouldn't initialConfig be immutable?

		if (this.initialConfig.bbar) 		//if has a bbar
			if (!this.initialConfig.bbar.store) 	//that doesnt have a store yet
				this.initialConfig.bbar.store = this.initialConfig.store;	//than set it

		Ext.apply(this, this.initialConfig);		//this apply stuff actually sux - when we're here, initialConfig is already applied to 'this' (constructor of Ext.Component does this)

		//if column names are given as strings, substitute them to column definitions - this allows to change columns easily
		if (this.columns && this.columns.length > 0) {			//TODO dangerous if this.columns is not an array
			var index, column;
			//for (column in Iterator(this.columns)) {
			for (index in this.columns) {
				column = this.columns[index];
				if (typeof(column) != 'string') continue;		//if it's not a name, we're not interested
				try {
					column = this.ns.gridColumns[column]
					this.columns[index] = column; //replace column name with the real column definition
				} catch(e) {
					//invalid column name
					console.log('Column not found: ' + column);
				}
			};
		} else {
			//no columns were defined - add all available predefined columns
			this.columns = [];
			var index, column;
			//iterators and deconstricting assignments don't work in fuckin chrome... :/
			for (column in this.ns.gridColumnNames) {
				column = this.ns.gridColumnNames[column];
				if (typeof(column)=='string') this.columns.push(this.ns.gridColumns[column]);
			}
		}
};

{{app_label|title}}.{{name}}.gridPostInit = function() {
	this.relayEvents(this.getStore(),['load','save']);
	this.getStore().enableBubble(['load','save']);
};

{{app_label|title}}.{{name}}.GridPanel = Ext.extend(ExtPiston.grid.GridPanel, {
	initComponent:function() {
		this.namespace = '{{app_label|title}}.{{name|lower}}';
		this.ns = {{app_label|title}}.{{name}};

		this.ns.gridInit.apply(this,arguments);

		for(var n = 0; n < this.columns.length; n++)
		{
			//TODO merge this with code in editorgrid
			var col = this.columns[n];
			if (col.hidden && !col.hideable || !col.fk) continue;
			if (!col.editor) col.editor = this.ns.formFields[col.name];
			if (col.fk && !col.renderer) col.renderer = fkrenderer;
		}

		this.ns.GridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange','rowselect']);

		this.ns.gridPostInit.apply(this,arguments);
	} //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.grid',{{app_label|title}}.{{name}}.GridPanel);

{{app_label|title}}.{{name}}.EditorGridPanel = Ext.extend(Ext.grid.EditorGridPanel, {
	initComponent:function() {
		this.ns = {{app_label|title}}.{{name}};
		var storeConfig = {
		};
		if (this.initialConfig.storeConfig)
			Ext.applyIf(this.initialConfig.storeConfig, storeConfig);
		else
			this.initialConfig.storeConfig = storeConfig;

		this.ns.gridInit.apply(this,arguments);

		var onSave = function onSave(btn, ev) {
			this.getStore().save();
		}
		//TODO zamienić to na akcje
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
			       if (!col.editor) col.editor = this.ns.formFields[col.name];
			       if (!(col.editor.xtype in Ext.ComponentMgr.types)) console.log('type ' +col.editor.xtype+ ' not available');
			       if ((col.fk || col.editor.xtype.endsWith('combo')) && !col.renderer) col.renderer = fkrenderer;
			}
		}
		this.ns.EditorGridPanel.superclass.initComponent.apply(this, arguments);

		this.relayEvents(this.getSelectionModel(),['selectionchange', 'cellselect']);
		this.addEvents(['addItem','removeItem']);

		this.ns.gridPostInit.apply(this,arguments);
	} //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.editorgrid',{{app_label|title}}.{{name}}.EditorGridPanel);

{{app_label|title}}.{{name}}.m2m = Ext.extend(ExtPiston.m2m.Panel, {
	initComponent: function() {
		var config = {
			valueField: '{{ value_field|default:"id" }}',
			displayField: '{{ display_field|default:"id" }}',
			url: '{{ name|lower }}',
			name: '{{ name|lower }}'
		};

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.m2m.superclass.initComponent.apply(this,arguments);
	} //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.m2m',{{app_label|title}}.{{name}}.m2m);
