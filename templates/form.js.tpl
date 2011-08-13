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
			labelWidth: 100,
			defaults: {width: 200},
			itemId: '{{ name|lower }}form',
			bubbleEvents: ['cancel','save'],
			buttons: [{
					text: 'Zapisz',
					handler: function() {
						var url = this.form.url;
						var pk = this.form.findField('{{pk}}');
						var method = 'POST';

						if (pk) {
							//TODO this should be done in beforeaction event
							var pkv = pk.getValue();
							if (pkv !== undefined && pkv !== null && pkv != "") {
								if (url.charAt(url.length-1)!='/') url+='/';
								url+=pkv;
								method = 'PUT';
							}
						}
						this.form.submit({
							url: url,
							method: method,
							failure: function(form,action) {
								switch (action.failureType) {
									case Ext.form.Action.CLIENT_INVALID:
										App.setAlert(false, 'Błąd danych w formularzu');
										break;
									case Ext.form.Action.CONNECT_FAILURE:
										App.setAlert(false, 'Błąd serwera');
										break;
									case Ext.form.Action.SERVER_INVALID:
										App.setAlert(false, action.result.message || 'PROCESSING ERROR');
										break;
								}
							},
							success: function(form,action) {
								App.setAlert(true, action.result.message || 'OK');
								this.fireEvent('save',form,action);		//TODO shouldn't we load recieved values into form here?
							},
							scope: this
						});
						//this.fireEvent('save');
					},
					scope: this
				},{
					text: 'Anuluj',
					handler: function() {
						this.fireEvent('cancel');
					},
					scope: this
				}]

		}; //config
		if (this.initialConfig.fields) {
			for (var name in this.initialConfig.fields) 
				if (typeof(name)=="string") 
					config.items.push({{app_label|title}}.{{name}}.{{name2|title}}formFields[name]);
		} else
			for (var name in {{app_label|title}}.{{name}}.{{name2|title}}formFields)
				config.items.push({{app_label|title}}.{{name}}.{{name2|title}}formFields[name]);

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		{{app_label|title}}.{{name}}.FormPanel.superclass.initComponent.apply(this, arguments);
	} //initComponent
	});
Ext.reg('{{app_label|lower}}.{{name|lower}}.{{name2|lower}}form',{{app_label|title}}.{{name}}.FormPanel);
