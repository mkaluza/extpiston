// vim: fileencoding=utf-8
// vim: filetype=javascript

Ext.namespace('ExtPiston.form');

ExtPiston.form.FormPanel = Ext.extend(Ext.form.FormPanel, {
	initComponent: function() {
		var config = {
			bodyStyle:'padding:5px 5px 0',
			bubbleEvents: ['cancel','save'],
			buttons: [{
					text: 'Zapisz',
					handler: function() {
						var url = this.form.url;
						var pkv = this.getPk();
						var method = 'POST';
						//TODO all this shoud be redefined using actions
						//TODO this should be done in beforeaction event
						if (pkv !== undefined && pkv !== null && pkv != "") {
							if (url.charAt(url.length-1)!='/') url+='/';
							url+=pkv;
							method = 'PUT';
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
								form.setValues(action.result.data);
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
				}],
			defaults: {anchor: '100%'},
			frame: true,
			items: [],
			labelWidth: 100,
			loadMask: true
		}

		Ext.apply(this, Ext.applyIf(this.initialConfig, config));

		ExtPiston.form.FormPanel.superclass.initComponent.apply(this, arguments);

		//TODO do it using create sequence
		var old_f = this.form.setValues.createDelegate(this.form);
		var setValues = function(values) {
			old_f(values);
			this.fireEvent('setvalues',this,values);
		}
		this.form.setValues = setValues.createDelegate(this.form);
		this.form.addEvents('setvalues');
		this.form.getPk = this.getPk.createDelegate(this);
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
		var url = this.form.url;
		var pk = this.form.findField(this.pkField);
		if (!pk) return null;
		var pkv = pk.getValue();
		return pkv;
	}
});

Ext.reg('extpiston.form',ExtPiston.form.FormPanel);
