{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.gridColumns = {{ gridColumns }};
{{app_label|title}}.{{name}}.gridColumnNames = {{ gridColumnNames }};

{{app_label|title}}.{{name}}.gridInit = function() {
		var config = {
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
			separateStore: {{ separate_store|lower }},
			childUrl: '{{ name|lower }}'		//URL part, that is appended to baseUrl, when the component is a child component
		}; //config

		if (!this.store) {
			//no store was given or defined
			if (config.separateStore) {
				this.store = new this.ns.JsonStore(Ext.applyIf({storeId: null},this.storeConfig));		//TODO force json store or use default?

				this.store.on('save', function() {
						var st = Ext.StoreMgr.get(this.ns.GlobalStoreName);
						if (st) st.load();
						}, this);		//reload global store when data change
			} else {
				//this.store =  Ext.StoreMgr.get(this.ns.Store.storeId);	//TODO tak nei działa, musi być (new this.ns.Store()).storeId
				this.store =  Ext.StoreMgr.get(this.ns.GlobalStoreName);
			}
		}

		if (this.viewConfig)
			Ext.applyIf(this.viewConfig, config.viewConfig);	//apply default configuration for view

		this.store.on('beforeload', this.setDynamicBaseUrl, this);
		this.store.on('beforesave', this.setDynamicBaseUrl, this);
		this.store.on('beforewrite', this.setDynamicBaseUrl, this); //is this necessary?

		Ext.applyIf(this, config);

		if (this.bbar) 		//if has a bbar
			if (!this.bbar.store) 	//that doesnt have a store yet
				this.bbar.store = this.store;	//than set it

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
	initComponent: function initComponent() {
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

{{app_label|title}}.{{name}}.EditorGridPanel = Ext.extend(ExtPiston.grid.EditorGridPanel, {
	initComponent: function initComponent() {
		this.ns = {{app_label|title}}.{{name}};

		this.ns.gridInit.apply(this,arguments);

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
	}, //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.editorgrid',{{app_label|title}}.{{name}}.EditorGridPanel);

{{app_label|title}}.{{name}}.m2m = Ext.extend(ExtPiston.m2m.Panel, {
	initComponent: function initComponent() {
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
