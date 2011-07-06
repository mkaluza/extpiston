{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.ComboBox = Ext.extend(Ext.form.ComboBox, {
	initComponent:function() {
		{% if config.separate_store %}
		{% include "mksoftware/store.js.tpl" %}
		{% endif %}
		var config = {
			store: {{name}}Store,
			fieldLabel: '{{ verbose_name }}',
			triggerAction: 'all',			//The action to execute when the trigger is clicked. (query/all)
			emptyText: 'Wybierz...',
			forceSelection: true,			//true to restrict the selected value to one of the values in the list, false to allow the user to set arbitrary text into the field (defaults to false)
			typeAhead: true,			//true to populate and autoselect the remainder of the text being typed after a configurable delay (typeAheadDelay) if it matches a known value (defaults to false)
			//typeAheadDelay: 250,			//The length of time in milliseconds to wait until the typeahead text is displayed if typeAhead = true (defaults to 250)
			selectOnFocus:true,			//true to select any existing text in the field immediately on focus. Only applies when editable = true (defaults to false).
			valueField: '{{ value_field|default:"id" }}',
			displayField: '{{ display_field|default:"id" }}',
			name: '{{ name|lower }}',
			hiddenName: '{{ name|lower }}'
		}; //config
		
		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.ComboBox.superclass.initComponent.apply(this, arguments);

	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.combobox',{{app_label|title}}.{{name|title}}.ComboBox);
