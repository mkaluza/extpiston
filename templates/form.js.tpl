{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');
var {{app_name}}{{name}}Items = {{ columns }}

{{app_label|title}}.{{name}}.FormPanel = Ext.extend(Ext.form.FormPanel, {
	initComponent:function() {
		var config = {
			title: '{{ verbose_name|title }}',
			frame: true,
			bodyStyle:'padding:5px 5px 0',
			url: '{{app_label}}/api/{{ name|lower }}',
			items: {{app_name}}{{name}}Items,
			loadMask: true,
			itemId: '{{ name|lower }}form'
		}; //config

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.FormPanel.superclass.initComponent.apply(this, arguments);
	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.form',{{app_label|title}}.{{name}}.FormPanel);
