// vim: fileencoding=utf-8
// vim: filetype=javascript

Ext.namespace('ExtPiston.form');

ExtPiston.form.FormPanel = Ext.extend(Ext.form.FormPanel, {
	initComponent: function() {
		var config = {
			bodyStyle:'padding:5px 5px 0',
			bubbleEvents: ['cancel','save'],
			defaults: {anchor: '100%'},
			frame: true,
			items: [],
			labelWidth: 100,
			loadMask: true
		}

		//TODO change save to submit
		var _actions = {
			save: {
				text: 'Zapisz',
				handler: function() {
					this.form.submit({
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
							form.setValues(action.result.data);
							this.fireEvent('save',form,action);		//TODO shouldn't we load recieved values into form here?
						},
						scope: this
					});
					//this.fireEvent('save');
				},
				name: 'save'
			},
			cancel: {
				text: 'Anuluj',
				handler: function() {
					this.fireEvent('cancel');
				},
				name: 'cancel'
			}
		}

		//add any actions given by the user to our actions
		this.actions = processActions(this.initialConfig.actions || ['save','cancel'], _actions, this);

		if (this.actions.length>0) {
			if (this.initialConfig.buttons)
				this.buttons = this.initialConfig.buttons;
			else
				this.buttons = [];

			this.actions.each(function(action,index,length) {
				this.buttons.push(action);
				if (index<length-1) this.buttons.push('-');
			}, this);
		}

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		ExtPiston.form.FormPanel.superclass.initComponent.apply(this, arguments);

		/*
		//TODO do it using create sequence
		var old_f = this.form.setValues.createDelegate(this.form);
		var setValues = function(values) {
			old_f(values);
			this.fireEvent('setvalues',this,values);
		}
		this.form.setValues = setValues.createDelegate(this.form);
		*/

		this.form.setValues = this.form.setValues.createSequence(function(values) {
				this.fireEvent('setvalues',this,values);
			},
			this.form			//TODO to nie jest do konca potrzebne chyba
		);

		this.form.addEvents('setvalues');
		this.form.getPk = this.getPk.createDelegate(this);

		this.on('beforeaction',this.beforeAction,this);
	}, //initComponent
	getBaseUrl: function(param1) {
		var pk = this.getPk();
		if (pk !== undefined && pk !== null && pk != "") {
			if (url.charAt(url.length-1)!='/') url+='/';
			url+=pk;
			return url;
		}
		if (param1)
			return url;
		else
			return null;
	},
	getPk: function() {
		var pk = this.form.findField(this.pkField);
		if (!pk) return null;
		var pkv = pk.getValue();
		return pkv;
	},
	beforeAction: function(form, action) {
		var url = this.form.url;
		var pkv = this.getPk();
		var method = 'POST';
		var o = action.options;
		if (pkv !== undefined && pkv !== null && pkv != "") {
			if (url.charAt(url.length-1)!='/') url+='/';
			url+=pkv;
			o.method = 'PUT';
		} else o.method = 'POST';

		o.url = url;
	}
});

Ext.reg('extpiston.form',ExtPiston.form.FormPanel);
