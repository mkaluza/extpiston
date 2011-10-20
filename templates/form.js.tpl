{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}
{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');
{{app_label|title}}.{{name}}.{{name2|title}}formFields = {{ formFields }};
{{app_label|title}}.{{name}}.{{name2|title}}formFieldNames = {{ formFieldNames }};

{{app_label|title}}.{{name}}.{{name2|title}}FormPanel = Ext.extend(ExtPiston.form.FormPanel, {
	constructor: function constructor(cfg) {
		var config = {
			itemId: '{{ name|lower }}form',
			pkField: '{{pk}}',
			title: '{{ verbose_name|title }}',
			url: '{{app_label}}/api/{{ name|lower }}'
		}; //config
		this.ns = {{app_label|title}}.{{name}};

		this.ns.FormPanel.superclass.constructor.call(this, cfg);

		Ext.applyIf(this, config);
	} //constructor
});
Ext.reg('{{app_label|lower}}.{{name|lower}}.{{name2|lower}}form',{{app_label|title}}.{{name}}.FormPanel);
