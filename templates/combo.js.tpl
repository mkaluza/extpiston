{# vim: fileencoding=utf-8 #}
{# vim: filetype=javascript #}

{# na podstawie http://blog.extjs.eu/know-how/writing-a-big-application-in-ext/ #}

Ext.namespace('{{app_label|title}}.{{name}}');

{{app_label|title}}.{{name}}.ComboBox = Ext.extend(Ext.form.ComboBox, {
	initComponent:function() {
		{% if separate_store %}
		//TODO fix for global stores
		{% endif %}
		var config = {
			store: new {{app_label|title}}.{{name}}.Store({autoLoad: this.initialConfig.autoLoad || true}),
			mode: 'local', 				//Automatically loads the store the first time the trigger is clicked. If you do not want the store to be automatically loaded the first time the trigger is clicked, set to 'local' and manually load the store. To force a requery of the store every time the trigger is clicked see lastQuery.
			fieldLabel: '{{ verbose_name }}',
			triggerAction: 'all',			//The action to execute when the trigger is clicked. (query/all)
			emptyText: 'Wybierz...',
			forceSelection: true,			//true to restrict the selected value to one of the values in the list, false to allow the user to set arbitrary text into the field (defaults to false)
			typeAhead: true,			//true to populate and autoselect the remainder of the text being typed after a configurable delay (typeAheadDelay) if it matches a known value (defaults to false)
			//typeAheadDelay: 250,			//The length of time in milliseconds to wait until the typeahead text is displayed if typeAhead = true (defaults to 250)
			selectOnFocus:true,			//true to select any existing text in the field immediately on focus. Only applies when editable = true (defaults to false).
			bubbleEvents: ['change','select'],
			valueField: '{{ value_field|default:"id" }}',
			displayField: '{{ display_field|default:"id" }}',
			name: '{{ name|lower }}'
		}; //config
		
		if (this.initialConfig.storeConfig) {
			console.log('error storeConfig in combo');
			Ext.apply(config.store,this.initialConfig.storeConfig);	//apply extra configuration for the store
		}

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));
		this.hiddenName = this.hiddenName || this.name;

		{{app_label|title}}.{{name}}.ComboBox.superclass.initComponent.apply(this, arguments);

		if (this.initialConfig.baseParams)
			for(var name in this.initialConfig.baseParams)
				this.store.setBaseParam(name,this.initialConfig.baseParams[name]);
		{% if store_type == 'json' %}
		this.store.load();
		{% endif %}

	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.combo',{{app_label|title}}.{{name}}.ComboBox);
