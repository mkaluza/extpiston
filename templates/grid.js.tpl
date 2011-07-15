{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.gridColumns = {{ gridColumns }}
{{app_label|title}}.{{name}}.gridColumnNames = {{ gridColumnNames }}

{{app_label|title}}.{{name}}.GridPanel = Ext.extend(Ext.grid.GridPanel, {
	initComponent:function() {
		{% if separate_store %}
		{% include "mksoftware/store.js.tpl" %}
		{% endif %}
		var config = {
			store: {{name}}StoreConfig,
			autoScroll: false,
			autoHeight: true,
			columns: [],
			loadMask: true,
			{% if page_size %}
			bbar: {
				xtype:'paging',
				pageSize: {{ page_size }},
				displayInfo: true,
				displayMsg: 'Wyniki {0} - {1} z {2}',
				emptyMsg: "Brak wyników"
			},
			{% endif %}
			viewConfig: {
				autoFill: true
			},
			itemId: '{{ name|lower }}'
		}; //config
		for (var name in {{app_label|title}}.{{name}}.gridColumns)
			config.columns.push({{app_label|title}}.{{name}}.gridColumns[name]);

		if (this.initialConfig.storeConfig)
			Ext.apply(config.store,this.initialConfig.storeConfig);	//apply extra configuration for the store

		if (!(this.initialConfig.store))
			config.store = new Ext.data.JsonStore(config.store); 		//if no store is supplied, create one from config

		Ext.applyIf(this.initialConfig, config);

		if (this.initialConfig.bbar) 		//if has a bbar
			if (!this.initialConfig.bbar.store) 	//that doesnt have a store yet
				this.initialConfig.bbar.store = this.initialConfig.store;	//than set it

		Ext.apply(this, this.initialConfig);


		{{app_label|title}}.{{name}}.GridPanel.superclass.initComponent.apply(this, arguments);
	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.grid',{{app_label|title}}.{{name}}.GridPanel);
