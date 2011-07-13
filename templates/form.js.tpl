{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');
{{app_label|title}}.{{name}}.{{name2|title}}formFields = {{ formFields }}
{{app_label|title}}.{{name}}.{{name2|title}}formFieldNames = {{ formFieldNames }}

{{app_label|title}}.{{name}}.{{name2|title}}FormPanel = Ext.extend(Ext.form.FormPanel, {
	initComponent:function() {
		var config = {
			title: '{{ verbose_name|title }}',
			frame: true,
			bodyStyle:'padding:5px 5px 0',
			url: '{{app_label}}/api/{{ name|lower }}',
			items: [],
			loadMask: true,
			defaults: {labelWidth: 100, width: 200},
			itemId: '{{ name|lower }}form',
			bubbleEvents: ['cancel','save'],
			buttons: [{
					text: 'Zapisz',
					handler: function() {
						this.fireEvent('save');
					}
				},{
					text: 'Anuluj',
					handler: function() {
						this.fireEvent('cancel');
					}
				}]

		}; //config
		if (this.initialConfig.fields) {
			for (var name in this.initialConfig.fields) 
				if (typeof(name)=="string") 
					config.items.push({{app_label|title}}.{{name}}.{{name2|title}}formFields[name]);
		} else
			for (var name in {{app_label|title}}.{{name}}.{{name2|title}}formFields) config.items.push({{app_label|title}}.{{name}}.{{name2|title}}formFields[name]);

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.FormPanel.superclass.initComponent.apply(this, arguments);
	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.{{name2|lower}}form',{{app_label|title}}.{{name}}.FormPanel);
