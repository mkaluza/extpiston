{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

var {{app_name}}{{name}}Columns = {{ columns }}

{{app_label|title}}.{{name}}.GridPanel = Ext.extend(Ext.grid.GridPanel, {
	initComponent:function() {
		{% if separate_store %}
		{% include "mksoftware/store.js.tpl" %}
		{% endif %}
		var config = {
			store: {{name}}Store,
			autoScroll: false,
			autoHeight: true,
			columns: {{app_name}}{{name}}Columns,
			loadMask: true,
			{% if page_size %}
			bbar: {
				xtype:'paging',
				pageSize: {{ page_size }},
				store: {{name}}Store,
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

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.GridPanel.superclass.initComponent.apply(this, arguments);
	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.grid',{{app_label|title}}.{{name}}.GridPanel);
