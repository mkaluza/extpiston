{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');
{{app_label|title}}.{{name}}.{{name2|title}}FormItems = {{ columns }}

{{app_label|title}}.{{name}}.{{name2|title}}FormPanel = Ext.extend(Ext.form.FormPanel, {
	initComponent:function() {
		var config = {
			title: '{{ verbose_name|title }}',
			frame: true,
			bodyStyle:'padding:5px 5px 0',
			url: '{{app_label}}/api/{{ name|lower }}',
			items: {{app_label|title}}.{{name}}.{{name2|title}}FormItems,
			loadMask: true,
			itemId: '{{ name|lower }}form'
		}; //config

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.FormPanel.superclass.initComponent.apply(this, arguments);
	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.{{name2|lower}}form',{{app_label|title}}.{{name}}.FormPanel);
