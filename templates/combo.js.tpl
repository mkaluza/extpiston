{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace({{appname|title}});

{{appname|title}}.{{name|title}}ComboBox = Ext.extend(Ext.form.ComboBox, {
	initComponent:function() {
		var config = {
			store: {{name}}Store,
			fieldLabel: '{{ verbose_name }}',
			triggerAction: 'all',			//The action to execute when the trigger is clicked. (query/all)
			emptyText: 'Wybierz...',
			forceSelection: true,			//true to restrict the selected value to one of the values in the list, false to allow the user to set arbitrary text into the field (defaults to false)
			typeAhead: true,			//true to populate and autoselect the remainder of the text being typed after a configurable delay (typeAheadDelay) if it matches a known value (defaults to false)
			typeAheadDelay: 250,			//The length of time in milliseconds to wait until the typeahead text is displayed if typeAhead = true (defaults to 250)
			selectOnFocus:true,			//true to select any existing text in the field immediately on focus. Only applies when editable = true (defaults to false).
		}; //config
		
		Ext.apply(this, Ext.apply(this.initialConfig, config));

		Application.PersonnelGrid.superclass.initComponent.apply(this, arguments);

	} //initComponent
	});
Ext.reg('{{appname|lower}}{{name|lower}}combobox',{{appname|title}}.{{name|title}}ComboBox);
