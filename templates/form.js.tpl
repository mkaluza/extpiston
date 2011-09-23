{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');
{{app_label|title}}.{{name}}.{{name2|title}}formFields = {{ formFields }}
{{app_label|title}}.{{name}}.{{name2|title}}formFieldNames = {{ formFieldNames }}

{{app_label|title}}.{{name}}.{{name2|title}}FormPanel = Ext.extend(ExtPiston.form.FormPanel, {
	initComponent:function() {
		var config = {
			items: [],
			itemId: '{{ name|lower }}form',
			pkField: '{{pk}}',
			title: '{{ verbose_name|title }}',
			url: '{{app_label}}/api/{{ name|lower }}'
		}; //config
		if (this.initialConfig.fields) {
			for (var name in this.initialConfig.fields) 
				if (typeof(name)=="string") 
					config.items.push({{app_label|title}}.{{name}}.{{name2|title}}formFields[name]);
					//TODO handle field definitions
		} else
			for (var name in {{app_label|title}}.{{name}}.{{name2|title}}formFieldNames) {
				name = {{app_label|title}}.{{name}}.{{name2|title}}formFieldNames[name]
				var field = {{app_label|title}}.{{name}}.{{name2|title}}formFields[name];
				if (field) config.items.push(field);
			}

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.FormPanel.superclass.initComponent.apply(this, arguments);
	}, //initComponent
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.{{name2|lower}}form',{{app_label|title}}.{{name}}.FormPanel);
